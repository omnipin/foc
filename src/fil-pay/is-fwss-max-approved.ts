import { decodeResult, encodeData } from 'ox/AbiFunction'
import type { Address } from 'ox/Address'
import { maxUint256 } from 'ox/Solidity'
import { type FilecoinChain, filProvider } from '../utils/constants.ts'

const abi = {
  type: 'function',
  inputs: [
    { name: 'token', internalType: 'contract IERC20', type: 'address' },
    { name: 'client', internalType: 'address', type: 'address' },
    { name: 'operator', internalType: 'address', type: 'address' },
  ],
  name: 'operatorApprovals',
  outputs: [
    { name: 'isApproved', type: 'bool' },
    { name: 'rateAllowance', type: 'uint256' },
    { name: 'lockupAllowance', type: 'uint256' },
    { name: 'rateUsage', type: 'uint256' },
    { name: 'lockupUsage', type: 'uint256' },
    { name: 'maxLockupPeriod', type: 'uint256' },
  ],
  stateMutability: 'view',
} as const

export type IsFwssMaxApprovedOptions = {
  /** The client (payer) address whose approval is being checked. */
  clientAddress: Address
  /** ERC20 token. Defaults to USDFC. */
  token?: Address
  /** Filecoin chain. */
  chain: FilecoinChain
}

/**
 * Check whether the FWSS storage operator has max (`maxUint256`) rate and
 * lockup allowances on behalf of `clientAddress`.
 *
 * Mirrors `@filoz/synapse-core/pay/isFwssMaxApproved`.
 *
 * Used by `getUploadCosts` to decide whether the next deposit should call
 * `depositWithPermit` (already approved) or `depositWithPermitAndApproveOperator`
 * (re-set max approval in the same tx).
 */
export const isFwssMaxApproved = async (
  options: IsFwssMaxApprovedOptions,
): Promise<boolean> => {
  const { clientAddress, chain } = options
  const provider = filProvider[chain.id]
  const token = options.token ?? chain.contracts.usdfc.address

  const result = await provider.request({
    method: 'eth_call',
    params: [
      {
        data: encodeData(abi, [
          token,
          clientAddress,
          chain.contracts.storage.address,
        ]),
        to: chain.contracts.payments.address,
      },
      'latest',
    ],
  })

  const [isApproved, rateAllowance, lockupAllowance] = decodeResult(abi, result)

  return (
    isApproved &&
    rateAllowance === maxUint256 &&
    lockupAllowance === maxUint256
  )
}

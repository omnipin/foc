import { encodeData } from 'ox/AbiFunction'
import type { Address } from 'ox/Address'
import { fromNumber, type Hex } from 'ox/Hex'
import * as Signature from 'ox/Signature'
import * as Value from 'ox/Value'
import { type FilecoinChain, filProvider } from '../utils/constants.ts'
import { getErc20WithPermitData } from './getErc20WithPermitData.ts'
import { signErc20Permit } from './signErc20Permit.ts'

const abi = {
  type: 'function',
  inputs: [
    { name: 'token', internalType: 'contract IERC20', type: 'address' },
    { name: 'to', internalType: 'address', type: 'address' },
    { name: 'amount', internalType: 'uint256', type: 'uint256' },
    { name: 'deadline', internalType: 'uint256', type: 'uint256' },
    { name: 'v', internalType: 'uint8', type: 'uint8' },
    { name: 'r', internalType: 'bytes32', type: 'bytes32' },
    { name: 's', internalType: 'bytes32', type: 'bytes32' },
  ],
  name: 'depositWithPermit',
  outputs: [],
  stateMutability: 'nonpayable',
} as const

/**
 * Build write parameters for `FilecoinPayV1.depositWithPermit` — deposits
 * USDFC into Filecoin Pay using an EIP-2612 permit signature, without
 * touching operator approval.
 *
 * Use this when the operator (FWSS) is already approved with sufficient
 * allowance. For first-time deposits, use
 * {@link depositWithPermitAndApproveOperatorWriteParameters}.
 */
export const depositWithPermitWriteParameters = async ({
  privateKey,
  address,
  amount,
  deadline = BigInt(Math.floor(Date.now() / 1000) + 3600),
  chain,
}: {
  privateKey: Hex
  address: Address
  amount: bigint
  deadline?: bigint
  chain: FilecoinChain
}) => {
  const [balance, name, nonce, version] = await getErc20WithPermitData({
    address,
    chain,
  })

  if (balance < amount) {
    throw new Error(
      `Not enough USDfc to deposit (need: ${
        Value.format(amount - balance, 18).slice(0, 5)
      })`,
    )
  }

  const { r, s, yParity } = await signErc20Permit({
    privateKey,
    address,
    amount,
    deadline,
    name,
    nonce,
    version,
    chain,
  })

  const data = encodeData(abi, [
    chain.contracts.usdfc.address,
    address,
    amount,
    deadline,
    yParity !== undefined ? Signature.yParityToV(yParity) : 27,
    fromNumber(r, { size: 32 }),
    fromNumber(s, { size: 32 }),
  ])

  return {
    provider: filProvider[chain.id],
    abi,
    from: address,
    to: chain.contracts.payments.address,
    data,
  }
}

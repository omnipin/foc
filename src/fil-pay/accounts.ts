import { decodeResult, encodeData } from 'ox/AbiFunction'
import { type Address } from 'ox/Address'
import { type FilecoinChain, filProvider } from '../utils/constants.ts'

const abi = {
  type: 'function',
  inputs: [
    { name: 'token', internalType: 'contract IERC20', type: 'address' },
    { name: 'owner', internalType: 'address', type: 'address' },
  ],
  name: 'accounts',
  outputs: [
    { name: 'funds', internalType: 'uint256', type: 'uint256' },
    { name: 'lockupCurrent', internalType: 'uint256', type: 'uint256' },
    { name: 'lockupRate', internalType: 'uint256', type: 'uint256' },
    { name: 'lockupLastSettledAt', internalType: 'uint256', type: 'uint256' },
  ],
  stateMutability: 'view',
} as const

export type AccountsOptions = {
  /** Account address to query. */
  address: Address
  /** ERC20 token. Defaults to USDFC. */
  token?: Address
  /** Filecoin chain. */
  chain: FilecoinChain
}

export type AccountsOutput = {
  /** Total deposited funds in the contract. */
  funds: bigint
  /** Current lockup amount (as last settled on-chain). */
  lockupCurrent: bigint
  /** Per-epoch rate at which lockup increases. */
  lockupRate: bigint
  /** Epoch when lockup was last settled. */
  lockupLastSettledAt: bigint
  /**
   * Naïvely projected available funds at the current epoch.
   *
   * `max(0, funds - lockupCurrent - lockupRate * (currentEpoch - lockupLastSettledAt))`.
   * For the *correct* projection (with `fundedUntilEpoch` clamping), use
   * {@link resolveAccountState} or {@link getAccountSummary}.
   */
  availableFunds: bigint
}

/**
 * Read raw account state from the Filecoin Pay contract and return it
 * alongside a naïve `availableFunds` view.
 *
 * Mirrors `@filoz/synapse-core/pay/accounts`.
 */
export const accounts = async (
  options: AccountsOptions,
): Promise<AccountsOutput> => {
  const { address, chain } = options
  const provider = filProvider[chain.id]
  const token = options.token ?? chain.contracts.usdfc.address

  const [result, currentEpochHex] = await Promise.all([
    provider.request({
      method: 'eth_call',
      params: [
        {
          data: encodeData(abi, [token, address]),
          to: chain.contracts.payments.address,
        },
        'latest',
      ],
    }),
    provider.request({ method: 'eth_blockNumber' }),
  ])

  const [funds, lockupCurrent, lockupRate, lockupLastSettledAt] = decodeResult(
    abi,
    result,
  )
  const currentEpoch = BigInt(currentEpochHex)
  const epochsSinceSettlement = currentEpoch > lockupLastSettledAt
    ? currentEpoch - lockupLastSettledAt
    : 0n
  const actualLockup = lockupCurrent + epochsSinceSettlement * lockupRate
  const availableFunds = funds > actualLockup ? funds - actualLockup : 0n

  return {
    funds,
    lockupCurrent,
    lockupRate,
    lockupLastSettledAt,
    availableFunds,
  }
}

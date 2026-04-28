import { type Address } from 'ox/Address'
import { type FilecoinChain, filProvider } from '../utils/constants.ts'
import { calculateAccountDebt } from './account-debt.ts'
import { accounts } from './accounts.ts'
import { resolveAccountState } from './resolve-account-state.ts'

export type GetAccountSummaryOptions = {
  address: Address
  token?: Address
  chain: FilecoinChain
  /** Epoch to evaluate at. If omitted, the current block number is fetched. */
  epoch?: bigint
}

export type GetAccountSummaryOutput = {
  /** Total deposited funds in the contract. */
  funds: bigint
  /** Funds available for new commitments at `epoch` (correctly clamped). */
  availableFunds: bigint
  /** Outstanding debt (0n if healthy). */
  debt: bigint
  /** Per-epoch lockup rate (aggregate across all rails). */
  lockupRate: bigint
  /** Epoch at which funds run out at the current rate. */
  fundedUntilEpoch: bigint
  /** The epoch used for all calculations. */
  epoch: bigint
}

/**
 * Get a comprehensive account summary from the Filecoin Pay contract.
 *
 * Fetches account state and (optionally) the current epoch in parallel,
 * then derives debt, available funds, and the funded-until timeline
 * client-side via {@link resolveAccountState} and {@link calculateAccountDebt}.
 *
 * Mirrors `@filoz/synapse-core/pay/getAccountSummary` minus the
 * `totalFixedLockup` field (omnipin does not enumerate rails).
 */
export const getAccountSummary = async (
  options: GetAccountSummaryOptions,
): Promise<GetAccountSummaryOutput> => {
  const { address, token, chain, epoch } = options
  const provider = filProvider[chain.id]

  const [accountInfo, resolvedEpoch] = await Promise.all([
    accounts({ address, token, chain }),
    epoch ?? provider.request({ method: 'eth_blockNumber' }).then(BigInt),
  ])

  const params = {
    funds: accountInfo.funds,
    lockupCurrent: accountInfo.lockupCurrent,
    lockupRate: accountInfo.lockupRate,
    lockupLastSettledAt: accountInfo.lockupLastSettledAt,
    currentEpoch: resolvedEpoch as bigint,
  }

  const { fundedUntilEpoch, availableFunds } = resolveAccountState(params)
  const debt = calculateAccountDebt(params)

  return {
    funds: accountInfo.funds,
    availableFunds,
    debt,
    lockupRate: accountInfo.lockupRate,
    fundedUntilEpoch,
    epoch: resolvedEpoch as bigint,
  }
}

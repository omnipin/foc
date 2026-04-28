/**
 * Compute account debt — the amount by which unsettled lockup exceeds
 * available funds.
 *
 * Pure function. Mirrors `@filoz/synapse-core/pay/calculateAccountDebt`.
 *
 * Total owed at `currentEpoch` is `lockupCurrent + lockupRate * elapsed`
 * (the value the contract would settle to). Debt is the positive part of
 * `(totalOwed - funds)`; an account is healthy iff debt is `0n`.
 */
export type CalculateAccountDebtParams = {
  funds: bigint
  lockupCurrent: bigint
  lockupRate: bigint
  lockupLastSettledAt: bigint
  currentEpoch: bigint
}

export const calculateAccountDebt = (
  params: CalculateAccountDebtParams,
): bigint => {
  const {
    funds,
    lockupCurrent,
    lockupRate,
    lockupLastSettledAt,
    currentEpoch,
  } = params

  const elapsed = currentEpoch > lockupLastSettledAt
    ? currentEpoch - lockupLastSettledAt
    : 0n
  const totalOwed = lockupCurrent + lockupRate * elapsed

  return totalOwed > funds ? totalOwed - funds : 0n
}

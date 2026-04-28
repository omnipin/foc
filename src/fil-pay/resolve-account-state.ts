/**
 * Project account state forward to `currentEpoch` by simulating settlement
 * locally.
 *
 * Pure function — no RPC. Mirrors
 * `@filoz/synapse-core/pay/resolveAccountState`.
 *
 * The Filecoin Pay contract's `settleAccountLockupBeforeAndAfter` modifier
 * advances `lockupCurrent` by `lockupRate * (block.number - lockupLastSettledAt)`
 * before any state-changing operation. To accurately predict the
 * "available funds" the contract will see at execution time, we mirror that
 * roll-forward here. We additionally clamp the elapsed window to
 * `min(currentEpoch, fundedUntilEpoch)` so that bankrupt accounts do not
 * accrue lockup beyond what their funds can cover (matching the contract's
 * implicit invariant that `lockupCurrent <= funds`).
 */
export type ResolveAccountStateParams = {
  funds: bigint
  lockupCurrent: bigint
  lockupRate: bigint
  lockupLastSettledAt: bigint
  currentEpoch: bigint
}

export type ResolveAccountStateOutput = {
  /** Epoch at which funds run out at the current lockup rate. */
  fundedUntilEpoch: bigint
  /** Funds available for new commitments at `currentEpoch` (>= 0). */
  availableFunds: bigint
}

const MAX_UINT256 =
  0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn

export const resolveAccountState = (
  params: ResolveAccountStateParams,
): ResolveAccountStateOutput => {
  const {
    funds,
    lockupCurrent,
    lockupRate,
    lockupLastSettledAt,
    currentEpoch,
  } = params

  const fundedUntilEpoch = lockupRate === 0n
    ? MAX_UINT256
    : lockupLastSettledAt + (funds - lockupCurrent) / lockupRate

  // simulatedSettledAt = min(fundedUntilEpoch, currentEpoch)
  const simulatedSettledAt = fundedUntilEpoch < currentEpoch
    ? fundedUntilEpoch
    : currentEpoch

  const elapsed = simulatedSettledAt > lockupLastSettledAt
    ? simulatedSettledAt - lockupLastSettledAt
    : 0n

  const simulatedLockupCurrent = lockupCurrent + lockupRate * elapsed

  const rawAvailable = funds > simulatedLockupCurrent
    ? funds - simulatedLockupCurrent
    : 0n

  return {
    fundedUntilEpoch,
    availableFunds: rawAvailable,
  }
}

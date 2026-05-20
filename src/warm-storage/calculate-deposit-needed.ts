import {
  DEFAULT_BUFFER_EPOCHS,
  DEFAULT_MINIMUM_NEW_DATASET_LOCKUP,
  DEFAULT_RUNWAY_EPOCHS,
} from '../utils/constants.ts'
import { calculateAdditionalLockupRequired } from './calculate-additional-lockup-required.ts'

/**
 * Calculate extra funds to ensure the account stays funded beyond the lockup
 * period.
 *
 * Pure function. Mirrors
 * `@filoz/synapse-core/warm-storage/calculateRunwayAmount`.
 */
export const calculateRunwayAmount = ({
  netRateAfterUpload,
  extraRunwayEpochs,
}: {
  netRateAfterUpload: bigint
  extraRunwayEpochs: bigint
}): bigint => netRateAfterUpload * extraRunwayEpochs

/**
 * Calculate the safety margin for epoch drift between the balance check and
 * the on-chain execution of a deposit / data-set-creation transaction.
 *
 * Pure function. Mirrors
 * `@filoz/synapse-core/warm-storage/calculateBufferAmount`, with one
 * additional concern: an optional **floor** that the on-chain
 * `availableFunds` must satisfy at tx execution. At v1.2.0 of FWSS, this
 * floor is `(minimumStorageRatePerMonth * DEFAULT_LOCKUP_PERIOD) /
 * EPOCHS_PER_MONTH + sybilFee`, enforced inline by
 * `FilecoinWarmStorageService.validatePayerOperatorApprovalAndFunds`. For
 * runtime use, callers should derive the floor from live
 * `getServicePricing()` data; for offline / default contexts,
 * {@link DEFAULT_MINIMUM_NEW_DATASET_LOCKUP} is a sensible value.
 *
 * Uses the *net* rate (current + delta) because in multi-tx flows, earlier
 * transactions create rails that start ticking before later transactions
 * execute.
 *
 * @example The bug the floor parameter fixes (real prod failure):
 *   availableFunds = 0.165 USDFC (just barely above the 0.16 floor)
 *   netRateAfterUpload = 1.68 USDFC/month  (an account with ~28 active rails)
 *   rawDepositNeeded = 0n (lockup.total == 0.16 ≤ availableFunds)
 *   fundedUntilEpoch is thousands of epochs out (so the legacy runway-only
 *     branch returns 0n)
 *   → buffer = 0n, depositNeeded = 0n
 *   → A few epochs of drift drains availableFunds below 0.16
 *   → on-chain `dataSetCreated` reverts with `InsufficientLockupFunds`
 *
 *   With `availableFundsFloor = DEFAULT_MINIMUM_NEW_DATASET_LOCKUP`, the
 *   buffer is topped up to guarantee `availableFunds + buffer -
 *   netRate*bufferEpochs >= floor` at tx execution.
 */
export const calculateBufferAmount = ({
  rawDepositNeeded,
  netRateAfterUpload,
  fundedUntilEpoch,
  currentEpoch,
  availableFunds,
  bufferEpochs,
  availableFundsFloor,
}: {
  rawDepositNeeded: bigint
  netRateAfterUpload: bigint
  fundedUntilEpoch: bigint
  currentEpoch: bigint
  availableFunds: bigint
  bufferEpochs: bigint
  /**
   * Optional. If set, requires that, after applying the returned buffer,
   * `availableFunds + buffer - netRateAfterUpload * bufferEpochs >=
   * availableFundsFloor`. Use this to protect against on-chain minimum-funds
   * checks that fire regardless of the account's runway (e.g. FWSS
   * `validatePayerOperatorApprovalAndFunds` requires `availableFunds >=
   * (minimumStorageRatePerMonth*LOCKUP_PERIOD)/EPOCHS_PER_MONTH + sybilFee`
   * for any new dataset).
   *
   * If omitted, behavior matches the legacy
   * (synapse-core-equivalent) implementation.
   */
  availableFundsFloor?: bigint
}): bigint => {
  let baseBuffer: bigint
  if (rawDepositNeeded > 0n) {
    // Deposit is needed — add buffer so it remains sufficient at T_exec.
    baseBuffer = netRateAfterUpload * bufferEpochs
  } else if (fundedUntilEpoch <= currentEpoch + bufferEpochs) {
    // No new lockup needed, but the account expires within the buffer window.
    const bufferCost = netRateAfterUpload * bufferEpochs
    const needed = bufferCost - availableFunds
    baseBuffer = needed > 0n ? needed : 0n
  } else {
    // Account has sufficient runway — no runway-based buffer needed.
    baseBuffer = 0n
  }

  if (availableFundsFloor === undefined) return baseBuffer

  // Floor guard. The on-chain check sees:
  //   availableFunds_at_tx = availableFunds + (depositNeeded) - netRate*drift
  // where `depositNeeded = clamp(rawDepositNeeded, 0n) + buffer`. We need
  // this to be ≥ floor for any `drift ≤ bufferEpochs`, so:
  //   availableFunds + clamped(rawDepositNeeded) + buffer
  //     - netRate * bufferEpochs ≥ floor
  // Solving for buffer:
  //   buffer ≥ floor + netRate*bufferEpochs
  //          - availableFunds - clamped(rawDepositNeeded)
  const clampedRaw = rawDepositNeeded > 0n ? rawDepositNeeded : 0n
  const floorBuffer = availableFundsFloor +
    netRateAfterUpload * bufferEpochs - availableFunds - clampedRaw
  return floorBuffer > baseBuffer ? floorBuffer : baseBuffer
}

export type CalculateDepositNeededParams = {
  /** Size of new data being uploaded, in bytes. */
  dataSize: bigint
  /** Current total dataset size, in bytes. 0n for new datasets. */
  currentDataSetSize: bigint
  /** Price per TiB per month from `getServicePrice()`. */
  pricePerTiBPerMonth: bigint
  /** Minimum monthly charge from `getServicePrice()`. */
  minimumPricePerMonth: bigint
  /** Epochs per month. */
  epochsPerMonth?: bigint
  /** Lockup period in epochs. */
  lockupEpochs?: bigint
  /** Whether a new dataset is being created. */
  isNewDataSet: boolean

  /** Account's current aggregate `lockupRate` across all rails. */
  currentLockupRate: bigint
  /** Extra runway epochs beyond the required lockup. */
  extraRunwayEpochs?: bigint

  /** Account debt from `calculateAccountDebt`. */
  debt: bigint
  /** Account's available funds from `resolveAccountState`. */
  availableFunds: bigint
  /** Account's `fundedUntilEpoch` from `resolveAccountState`. */
  fundedUntilEpoch: bigint

  /** Current chain epoch (block number). */
  currentEpoch: bigint
  /** Safety margin in epochs. Defaults to `DEFAULT_BUFFER_EPOCHS` (5n). */
  bufferEpochs?: bigint

  /**
   * Optional. If set, ensures the deposit is sized so that at on-chain tx
   * execution time (≤ `bufferEpochs` epochs after this calculation),
   * `availableFunds >= availableFundsFloor`.
   *
   * For new-dataset flows, callers should pass the live
   * `(minimumPricePerMonth * LOCKUP_PERIOD) / epochsPerMonth + sybilFee`
   * (or {@link DEFAULT_MINIMUM_NEW_DATASET_LOCKUP} as a default) to mirror
   * the FWSS `validatePayerOperatorApprovalAndFunds` check.
   * {@link getUploadCosts} sets this automatically using the live pricing
   * returned by `getServicePricing()`.
   *
   * For add-pieces flows (no new rail, no sybil fee, no floor check
   * on-chain), leave undefined.
   */
  availableFundsFloor?: bigint
}

/**
 * Orchestrate `lockup + runway + debt + buffer` to compute total deposit
 * needed.
 *
 * Pure function. Mirrors
 * `@filoz/synapse-core/warm-storage/calculateDepositNeeded`.
 *
 * Skip-buffer rule: when `currentLockupRate === 0n && isNewDataSet`, the
 * deposit lands before any rail exists, so nothing drains in the gap; no
 * buffer is needed.
 */
export const calculateDepositNeeded = (
  params: CalculateDepositNeededParams,
): bigint => {
  const lockup = calculateAdditionalLockupRequired({
    dataSize: params.dataSize,
    currentDataSetSize: params.currentDataSetSize,
    pricePerTiBPerMonth: params.pricePerTiBPerMonth,
    minimumPricePerMonth: params.minimumPricePerMonth,
    epochsPerMonth: params.epochsPerMonth,
    lockupEpochs: params.lockupEpochs,
    isNewDataSet: params.isNewDataSet,
  })

  const netRateAfterUpload = params.currentLockupRate + lockup.rateDeltaPerEpoch
  const extraRunwayEpochs = params.extraRunwayEpochs ?? DEFAULT_RUNWAY_EPOCHS
  const bufferEpochs = params.bufferEpochs ?? DEFAULT_BUFFER_EPOCHS

  const runway = calculateRunwayAmount({
    netRateAfterUpload,
    extraRunwayEpochs,
  })

  const rawDepositNeeded = lockup.total + runway + params.debt -
    params.availableFunds

  // Skip buffer when no existing rails are draining and this is a new dataset.
  // The deposit lands before any rail is created, so nothing consumes funds
  // between balance check and tx execution.
  const skipBuffer = params.currentLockupRate === 0n && params.isNewDataSet

  const buffer = skipBuffer ? 0n : calculateBufferAmount({
    rawDepositNeeded,
    netRateAfterUpload,
    fundedUntilEpoch: params.fundedUntilEpoch,
    currentEpoch: params.currentEpoch,
    availableFunds: params.availableFunds,
    bufferEpochs,
    availableFundsFloor: params.availableFundsFloor,
  })

  const clamped = rawDepositNeeded > 0n ? rawDepositNeeded : 0n
  return clamped + buffer
}

/**
 * Re-exported for convenience: the default on-chain minimum `availableFunds`
 * for new (non-CDN) dataset creation, at FWSS v1.2.0's initial pricing.
 *
 * Pass this — or, preferably, a value derived from live
 * `getServicePricing()` data — as `availableFundsFloor` to
 * {@link calculateDepositNeeded} or {@link calculateBufferAmount} when
 * `isNewDataSet === true`.
 */
export { DEFAULT_MINIMUM_NEW_DATASET_LOCKUP }

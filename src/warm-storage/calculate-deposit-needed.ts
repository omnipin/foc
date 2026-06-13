import {
  DEFAULT_BUFFER_EPOCHS,
  DEFAULT_NEW_DATASET_FIXED_FUNDS,
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
 * `availableFunds` must satisfy at tx execution. As of FWSS v1.3.0, creating
 * a dataset locks a fixed lifecycle reserve plus a one-time creation fee on
 * the PDP rail, so callers should size `availableFunds` to cover that fixed
 * cost ({@link DEFAULT_NEW_DATASET_FIXED_FUNDS}, or the live
 * `lockups.lifecycleReserveTarget + fees.createDataSetFee` from
 * `getPriceList()`) on top of the streaming-rate lockup.
 *
 * Uses the *net* rate (current + delta) because in multi-tx flows, earlier
 * transactions create rails that start ticking before later transactions
 * execute.
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
   * requirements that fire regardless of the account's runway (e.g. the
   * fixed lifecycle reserve + creation fee a new FWSS v1.3.0 dataset locks
   * on the PDP rail at creation).
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
  /** Size-proportional storage rate, per TiB per month (`rates.storagePerTibPerMonth`). */
  storagePerTibPerMonth: bigint
  /** Flat per-dataset additive monthly fee (`rates.datasetFeePerMonth`). */
  datasetFeePerMonth: bigint
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
   * Up-front fixed lockup for a new dataset (lifecycle reserve). Forwarded to
   * {@link calculateAdditionalLockupRequired}; defaults there to
   * {@link LIFECYCLE_RESERVE_TARGET}. Pass `lockups.lifecycleReserveTarget`
   * from a live `getPriceList()` for runtime use.
   */
  lifecycleReserveTarget?: bigint
  /**
   * One-time dataset creation fee. Forwarded to
   * {@link calculateAdditionalLockupRequired}; defaults there to
   * {@link CREATE_DATA_SET_FEE}. Pass `fees.createDataSetFee` from a live
   * `getPriceList()` for runtime use.
   */
  createDataSetFee?: bigint

  /**
   * Optional. If set, ensures the deposit is sized so that at on-chain tx
   * execution time (≤ `bufferEpochs` epochs after this calculation),
   * `availableFunds >= availableFundsFloor`.
   *
   * For new-dataset flows, callers should pass the live
   * `lockups.lifecycleReserveTarget + fees.createDataSetFee`
   * (or {@link DEFAULT_NEW_DATASET_FIXED_FUNDS} as a default) so the deposit
   * keeps the account above the fixed funds the FWSS creation flow locks.
   * {@link getUploadCosts} sets this automatically using the live price list
   * returned by `getPriceList()`.
   *
   * For add-pieces flows (no new rail, no fixed lockup), leave undefined.
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
    storagePerTibPerMonth: params.storagePerTibPerMonth,
    datasetFeePerMonth: params.datasetFeePerMonth,
    epochsPerMonth: params.epochsPerMonth,
    lockupEpochs: params.lockupEpochs,
    isNewDataSet: params.isNewDataSet,
    lifecycleReserveTarget: params.lifecycleReserveTarget,
    createDataSetFee: params.createDataSetFee,
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
 * Re-exported for convenience: the default up-front fixed USDFC a new
 * (non-CDN) dataset locks at FWSS v1.3.0 (lifecycle reserve + creation fee).
 *
 * Pass this — or, preferably, a value derived from a live `getPriceList()`
 * (`lockups.lifecycleReserveTarget + fees.createDataSetFee`) — as
 * `availableFundsFloor` to {@link calculateDepositNeeded} or
 * {@link calculateBufferAmount} when `isNewDataSet === true`.
 */
export { DEFAULT_NEW_DATASET_FIXED_FUNDS }

import {
  CREATE_DATA_SET_FEE,
  LIFECYCLE_RESERVE_TARGET,
  LOCKUP_PERIOD,
  TIME_CONSTANTS,
} from '../utils/constants.ts'
import { calculateEffectiveRate } from './calculate-effective-rate.ts'

/**
 * Compute how much additional lockup this upload requires under FWSS v1.3.0.
 *
 * Pure function. Mirrors the post-upgrade funding model:
 * - The streaming storage rate (size-proportional + flat dataset fee) drives
 *   the per-epoch rail rate and its lockup over the lockup period.
 * - Creating a new dataset locks the {@link LIFECYCLE_RESERVE_TARTGET}
 *   lifecycle reserve on the PDP rail and records the
 *   {@link CREATE_DATA_SET_FEE} as a pending one-time payment drawn from it.
 *   These replace the removed v1.2.x sybil fee.
 *
 * No minimum-rate floor exists anymore, so adding data to a dataset always
 * has a non-negative rate delta.
 */
export type CalculateAdditionalLockupRequiredParams = {
  /** Size of new data being uploaded, in bytes. */
  dataSize: bigint
  /** Current total dataset size, in bytes. 0n for new datasets. */
  currentDataSetSize: bigint
  /** Size-proportional storage rate, per TiB per month (`rates.storagePerTibPerMonth`). */
  storagePerTibPerMonth: bigint
  /** Flat per-dataset additive monthly fee (`rates.datasetFeePerMonth`). */
  datasetFeePerMonth: bigint
  /** Epochs per month. Defaults to `TIME_CONSTANTS.EPOCHS_PER_MONTH`. */
  epochsPerMonth?: bigint
  /** Lockup period in epochs. Defaults to `LOCKUP_PERIOD` (30 days). */
  lockupEpochs?: bigint
  /** Whether a new dataset is being created (vs adding to existing). */
  isNewDataSet: boolean
  /**
   * Up-front fixed lockup for a new dataset (lifecycle reserve). Defaults to
   * {@link LIFECYCLE_RESERVE_TARGET}. Pass `lockups.lifecycleReserveTarget`
   * from a live `getPriceList()` for runtime use. Ignored when
   * `isNewDataSet` is false.
   */
  lifecycleReserveTarget?: bigint
  /**
   * One-time dataset creation fee. Defaults to {@link CREATE_DATA_SET_FEE}.
   * Pass `fees.createDataSetFee` from a live `getPriceList()` for runtime
   * use. Ignored when `isNewDataSet` is false.
   */
  createDataSetFee?: bigint
}

export type CalculateAdditionalLockupRequiredOutput = {
  /** Per-epoch rate increase from this upload. */
  rateDeltaPerEpoch: bigint
  /** Lockup increase from the rate change = `rateDeltaPerEpoch * lockupEpochs`. */
  rateLockupDelta: bigint
  /** Lifecycle reserve locked on creation (only for new datasets). */
  lifecycleReserve: bigint
  /** One-time dataset creation fee (only for new datasets). */
  createDataSetFee: bigint
  /** `rateLockupDelta + lifecycleReserve + createDataSetFee`. */
  total: bigint
}

export const calculateAdditionalLockupRequired = (
  params: CalculateAdditionalLockupRequiredParams,
): CalculateAdditionalLockupRequiredOutput => {
  const {
    dataSize,
    currentDataSetSize,
    storagePerTibPerMonth,
    datasetFeePerMonth,
    epochsPerMonth = TIME_CONSTANTS.EPOCHS_PER_MONTH,
    lockupEpochs = LOCKUP_PERIOD,
    isNewDataSet,
    lifecycleReserveTarget = LIFECYCLE_RESERVE_TARGET,
    createDataSetFee = CREATE_DATA_SET_FEE,
  } = params

  const rateParams = {
    storagePerTibPerMonth,
    datasetFeePerMonth,
    epochsPerMonth,
  }

  let rateDeltaPerEpoch: bigint

  if (currentDataSetSize > 0n && !isNewDataSet) {
    // Existing dataset: compute the delta between new and current rates.
    const newRate = calculateEffectiveRate({
      ...rateParams,
      sizeInBytes: currentDataSetSize + dataSize,
    })
    const currentRate = calculateEffectiveRate({
      ...rateParams,
      sizeInBytes: currentDataSetSize,
    })
    rateDeltaPerEpoch = newRate.ratePerEpoch - currentRate.ratePerEpoch
    if (rateDeltaPerEpoch < 0n) rateDeltaPerEpoch = 0n
  } else {
    // New dataset (or unknown current size): full rate for the new data.
    const newRate = calculateEffectiveRate({
      ...rateParams,
      sizeInBytes: dataSize,
    })
    rateDeltaPerEpoch = newRate.ratePerEpoch
  }

  const rateLockupDelta = rateDeltaPerEpoch * lockupEpochs
  const lifecycleReserve = isNewDataSet ? lifecycleReserveTarget : 0n
  const oneTimeFee = isNewDataSet ? createDataSetFee : 0n

  return {
    rateDeltaPerEpoch,
    rateLockupDelta,
    lifecycleReserve,
    createDataSetFee: oneTimeFee,
    total: rateLockupDelta + lifecycleReserve + oneTimeFee,
  }
}

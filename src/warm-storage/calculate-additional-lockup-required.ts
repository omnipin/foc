import {
  LOCKUP_PERIOD,
  TIME_CONSTANTS,
  USDFC_SYBIL_FEE,
} from '../utils/constants.ts'
import { calculateEffectiveRate } from './calculate-effective-rate.ts'

/**
 * Compute how much additional lockup this upload requires.
 *
 * Pure function. Mirrors
 * `@filoz/synapse-core/warm-storage/calculateAdditionalLockupRequired`,
 * minus the `withCDN` branch (omnipin does not use CDN).
 *
 * Handles floor-to-floor transitions correctly: when both the current and
 * post-upload sizes are below the floor threshold, the rate delta is zero.
 */
export type CalculateAdditionalLockupRequiredParams = {
  /** Size of new data being uploaded, in bytes. */
  dataSize: bigint
  /** Current total dataset size, in bytes. 0n for new datasets. */
  currentDataSetSize: bigint
  /** Price per TiB per month from `getServicePrice()`. */
  pricePerTiBPerMonth: bigint
  /** Minimum monthly charge from `getServicePrice()`. */
  minimumPricePerMonth: bigint
  /** Epochs per month. Defaults to `TIME_CONSTANTS.EPOCHS_PER_MONTH`. */
  epochsPerMonth?: bigint
  /** Lockup period in epochs. Defaults to `LOCKUP_PERIOD` (30 days). */
  lockupEpochs?: bigint
  /** Whether a new dataset is being created (vs adding to existing). */
  isNewDataSet: boolean
}

export type CalculateAdditionalLockupRequiredOutput = {
  /** Per-epoch rate increase from this upload. */
  rateDeltaPerEpoch: bigint
  /** Lockup increase from the rate change = `rateDeltaPerEpoch * lockupEpochs`. */
  rateLockupDelta: bigint
  /** USDFC sybil fee (only for new datasets). */
  sybilFee: bigint
  /** `rateLockupDelta + sybilFee`. */
  total: bigint
}

export const calculateAdditionalLockupRequired = (
  params: CalculateAdditionalLockupRequiredParams,
): CalculateAdditionalLockupRequiredOutput => {
  const {
    dataSize,
    currentDataSetSize,
    pricePerTiBPerMonth,
    minimumPricePerMonth,
    epochsPerMonth = TIME_CONSTANTS.EPOCHS_PER_MONTH,
    lockupEpochs = LOCKUP_PERIOD,
    isNewDataSet,
  } = params

  const rateParams = {
    pricePerTiBPerMonth,
    minimumPricePerMonth,
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
    // Floor-to-floor: if both sizes are below floor, delta is 0.
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
  const sybilFee = isNewDataSet ? USDFC_SYBIL_FEE : 0n

  return {
    rateDeltaPerEpoch,
    rateLockupDelta,
    sybilFee,
    total: rateLockupDelta + sybilFee,
  }
}

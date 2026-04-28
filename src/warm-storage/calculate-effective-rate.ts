import { SIZE_CONSTANTS } from '../utils/constants.ts'

/**
 * Mirror the FWSS contract's `_calculateStorageRate` with floor pricing.
 *
 * Pure function. Mirrors
 * `@filoz/synapse-core/warm-storage/calculateEffectiveRate`.
 *
 * Returns two rates for different use cases:
 * - `ratePerEpoch` matches the on-chain PDP rail rate (use for lockup math).
 * - `ratePerMonth` retains higher precision and scales linearly with size
 *   (use for display/cost comparisons).
 *
 * The contract multiplies `totalBytes * pricePerTiBPerMonth` and divides by
 * `TiB * EPOCHS_PER_MONTH` in a single step, so `ratePerEpoch` truncation
 * depends on the total size and cannot be scaled to estimate other sizes.
 *
 * On-chain reference:
 * - `_calculateStorageRate`: https://github.com/FilOzone/filecoin-services/blob/main/service_contracts/src/FilecoinWarmStorageService.sol
 */
export type CalculateEffectiveRateParams = {
  /** Total data size in the dataset (existing + new), in bytes. */
  sizeInBytes: bigint
  /** Price per TiB per month from `getServicePrice()`. */
  pricePerTiBPerMonth: bigint
  /** Minimum monthly charge from `getServicePrice()`. */
  minimumPricePerMonth: bigint
  /** Epochs per month from `getServicePrice()` (always 86400n). */
  epochsPerMonth: bigint
}

export type CalculateEffectiveRateOutput = {
  ratePerEpoch: bigint
  ratePerMonth: bigint
}

export const calculateEffectiveRate = (
  params: CalculateEffectiveRateParams,
): CalculateEffectiveRateOutput => {
  const {
    sizeInBytes,
    pricePerTiBPerMonth,
    minimumPricePerMonth,
    epochsPerMonth,
  } = params

  // One division (by TiB) — preserves precision; linearly scalable with size.
  const naturalPerMonth = (pricePerTiBPerMonth * sizeInBytes) /
    SIZE_CONSTANTS.TiB

  // Two-factor division (by TiB * epochs) — matches contract's single-step
  // division. Truncation is size-dependent; only valid for this exact size.
  const naturalPerEpoch = (pricePerTiBPerMonth * sizeInBytes) /
    (SIZE_CONSTANTS.TiB * epochsPerMonth)

  // Floor rate per epoch derived from the floor monthly rate.
  const minimumPerEpoch = minimumPricePerMonth / epochsPerMonth

  const ratePerMonth = naturalPerMonth > minimumPricePerMonth
    ? naturalPerMonth
    : minimumPricePerMonth
  const ratePerEpoch = naturalPerEpoch > minimumPerEpoch
    ? naturalPerEpoch
    : minimumPerEpoch

  return { ratePerEpoch, ratePerMonth }
}

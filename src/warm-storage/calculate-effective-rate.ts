import { SIZE_CONSTANTS, TIME_CONSTANTS } from '../utils/constants.ts'

/**
 * Mirror the FWSS v1.3.0 storage-rate calculation.
 *
 * Pure function. Mirrors `PriceListUSDFC.calculateStorageSizeBasedRatePerEpoch`
 * / `calculateStorageRate` at the `v1.3.0` tag:
 *
 * ```solidity
 * ratePerEpoch = totalBytes * storagePerTibPerMonth / (TiB * EPOCHS_PER_MONTH)
 *              + datasetFeePerMonth / EPOCHS_PER_MONTH
 * ```
 *
 * The size-proportional term is the streaming storage charge; the flat
 * `datasetFeePerMonth` term is added once per non-empty dataset. There is no
 * minimum-rate floor anymore (removed in v1.3.0). An empty dataset
 * (`sizeInBytes === 0n`) yields a zero rate, matching the contract's
 * `leafCount == 0` short-circuit.
 *
 * Returns two rates for different use cases:
 * - `ratePerEpoch` matches the on-chain PDP rail rate (use for lockup math).
 * - `ratePerMonth` retains higher precision for display/cost comparisons.
 *
 * On-chain reference:
 * - `PriceListUSDFC.sol`: https://github.com/FilOzone/filecoin-services/blob/v1.3.0/service_contracts/src/lib/PriceListUSDFC.sol
 *
 * @see https://github.com/FilOzone/filecoin-services/releases/tag/v1.3.0
 */
export type CalculateEffectiveRateParams = {
  /** Total data size in the dataset (existing + new), in bytes. */
  sizeInBytes: bigint
  /** Size-proportional storage rate, per TiB per month (`rates.storagePerTibPerMonth`). */
  storagePerTibPerMonth: bigint
  /** Flat per-dataset additive monthly fee (`rates.datasetFeePerMonth`). */
  datasetFeePerMonth: bigint
  /** Epochs per month. Defaults to `TIME_CONSTANTS.EPOCHS_PER_MONTH` (86400n). */
  epochsPerMonth?: bigint
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
    storagePerTibPerMonth,
    datasetFeePerMonth,
    epochsPerMonth = TIME_CONSTANTS.EPOCHS_PER_MONTH,
  } = params

  // Empty dataset → zero rate (contract short-circuits on leafCount == 0).
  if (sizeInBytes === 0n) return { ratePerEpoch: 0n, ratePerMonth: 0n }

  // One division (by TiB) — preserves precision; size-proportional term only.
  const sizePerMonth = (storagePerTibPerMonth * sizeInBytes) /
    SIZE_CONSTANTS.TiB

  // Two-factor division (by TiB * epochs) — matches the contract's single-step
  // division for the size term. Truncation is size-dependent.
  const sizePerEpoch = (storagePerTibPerMonth * sizeInBytes) /
    (SIZE_CONSTANTS.TiB * epochsPerMonth)

  // Flat per-dataset fee, added on top of the size-proportional rate.
  const datasetFeePerEpoch = datasetFeePerMonth / epochsPerMonth

  return {
    ratePerEpoch: sizePerEpoch + datasetFeePerEpoch,
    ratePerMonth: sizePerMonth + datasetFeePerMonth,
  }
}

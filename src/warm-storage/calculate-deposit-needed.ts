import {
  DEFAULT_BUFFER_EPOCHS,
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
 * `@filoz/synapse-core/warm-storage/calculateBufferAmount`.
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
}: {
  rawDepositNeeded: bigint
  netRateAfterUpload: bigint
  fundedUntilEpoch: bigint
  currentEpoch: bigint
  availableFunds: bigint
  bufferEpochs: bigint
}): bigint => {
  if (rawDepositNeeded > 0n) {
    // Deposit is needed — add buffer so it remains sufficient at T_exec.
    return netRateAfterUpload * bufferEpochs
  }

  if (fundedUntilEpoch <= currentEpoch + bufferEpochs) {
    // No new lockup needed, but the account expires within the buffer window.
    const bufferCost = netRateAfterUpload * bufferEpochs
    const needed = bufferCost - availableFunds
    return needed > 0n ? needed : 0n
  }

  // Account has sufficient runway — no buffer needed.
  return 0n
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
  })

  const clamped = rawDepositNeeded > 0n ? rawDepositNeeded : 0n
  return clamped + buffer
}

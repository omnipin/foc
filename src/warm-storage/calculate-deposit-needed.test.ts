import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import {
  CREATE_DATA_SET_FEE,
  DEFAULT_BUFFER_EPOCHS,
  DEFAULT_NEW_DATASET_FIXED_FUNDS,
  LIFECYCLE_RESERVE_TARGET,
  TIME_CONSTANTS,
} from '../utils/constants.ts'
import {
  calculateBufferAmount,
  calculateDepositNeeded,
} from './calculate-deposit-needed.ts'

// Mainnet v1.3.0 pricing: 2.5 USDFC/TiB/month + 0.024 USDFC/month flat fee.
const basePricing = {
  storagePerTibPerMonth: 2_500_000_000_000_000_000n,
  datasetFeePerMonth: 24_000_000_000_000_000n,
  epochsPerMonth: TIME_CONSTANTS.EPOCHS_PER_MONTH,
}

describe('calculateDepositNeeded', () => {
  it('skips buffer for fresh accounts on new datasets', () => {
    // currentLockupRate = 0 && isNewDataSet → skipBuffer
    const deposit = calculateDepositNeeded({
      ...basePricing,
      dataSize: 1n << 20n,
      currentDataSetSize: 0n,
      isNewDataSet: true,
      currentLockupRate: 0n,
      debt: 0n,
      availableFunds: 0n,
      fundedUntilEpoch: 0n,
      currentEpoch: 0n,
    })
    // Equals lockup.total exactly (no buffer): rate lockup + lifecycle
    // reserve + creation fee. Must at least cover the fixed funds.
    expect(deposit >= DEFAULT_NEW_DATASET_FIXED_FUNDS).toBe(true)
  })

  it('adds buffer when an existing rail is draining', () => {
    const currentLockupRate = 2_777_777_777_776n
    // availableFunds below lockup.total (~0.149 USDFC) so a deposit is needed
    // and the buffer kicks in on top of it.
    const scenario = {
      ...basePricing,
      dataSize: 1n << 20n,
      currentDataSetSize: 0n,
      isNewDataSet: true,
      currentLockupRate,
      debt: 0n,
      availableFunds: 50_000_000_000_000_000n, // 0.05 USDFC
      fundedUntilEpoch: 1_000_000_000n,
      currentEpoch: 5_960_000n,
    }
    const deposit = calculateDepositNeeded(scenario)
    const unbuffered = calculateDepositNeeded({ ...scenario, bufferEpochs: 0n })
    expect(deposit > unbuffered).toBe(true)
    expect(deposit - unbuffered >= currentLockupRate * DEFAULT_BUFFER_EPOCHS)
      .toBe(true)
  })

  it('returns 0n when the account already has plenty of funds', () => {
    const deposit = calculateDepositNeeded({
      ...basePricing,
      dataSize: 1n << 20n,
      currentDataSetSize: 0n,
      isNewDataSet: true,
      currentLockupRate: 0n,
      debt: 0n,
      availableFunds: 10_000_000_000_000_000_000n, // 10 USDFC
      fundedUntilEpoch: 1_000_000_000n,
      currentEpoch: 0n,
    })
    expect(deposit).toBe(0n)
  })

  it('adds debt to the required deposit', () => {
    const debt = 1_000_000n
    const withDebt = calculateDepositNeeded({
      ...basePricing,
      dataSize: 1n << 20n,
      currentDataSetSize: 0n,
      isNewDataSet: true,
      currentLockupRate: 0n,
      debt,
      availableFunds: 0n,
      fundedUntilEpoch: 0n,
      currentEpoch: 0n,
    })
    const withoutDebt = calculateDepositNeeded({
      ...basePricing,
      dataSize: 1n << 20n,
      currentDataSetSize: 0n,
      isNewDataSet: true,
      currentLockupRate: 0n,
      debt: 0n,
      availableFunds: 0n,
      fundedUntilEpoch: 0n,
      currentEpoch: 0n,
    })
    expect(withDebt - withoutDebt).toBe(debt)
  })

  // Regression: on FWSS v1.3.0 a new dataset locks a fixed lifecycle reserve
  // (0.10 USDFC) + one-time creation fee (0.025 USDFC) on the PDP rail at
  // creation. If availableFunds sits right at that fixed amount while other
  // rails drain, a few epochs of drift can drop it below the fixed cost by
  // the time createDataSet executes. The availableFundsFloor guard tops up
  // the deposit so the account stays above the fixed funds at tx execution.
  describe('on-chain availableFunds floor (DEFAULT_NEW_DATASET_FIXED_FUNDS)', () => {
    // Drain rate high enough that bufferEpochs of drift breaches the fixed
    // funds floor even when availableFunds starts above the streaming lockup.
    const drainingRate = 5_000_000_000_000_000n // 0.005 USDFC/epoch

    it('forces a non-zero deposit when drift threatens the fixed-funds floor', () => {
      // availableFunds just above lockup.total (~0.149 USDFC) → no streaming
      // deposit needed, and funding stretches far out, so the legacy
      // runway-based buffer returns 0n.
      const lockupTotal = 149_238_418_579_020_800n // computed for 100 MiB new
      const scenario = {
        ...basePricing,
        dataSize: 100n * 1024n * 1024n,
        currentDataSetSize: 0n,
        isNewDataSet: true,
        currentLockupRate: drainingRate,
        debt: 0n,
        availableFunds: lockupTotal + 10n,
        fundedUntilEpoch: 6_040_000n, // far in the future
        currentEpoch: 6_032_000n,
      }
      const before = calculateDepositNeeded(scenario)
      expect(before).toBe(0n)

      const after = calculateDepositNeeded({
        ...scenario,
        availableFundsFloor: DEFAULT_NEW_DATASET_FIXED_FUNDS,
      })
      expect(after > 0n).toBe(true)

      // Depositing `after` must leave availableFunds ≥ floor after up to
      // bufferEpochs of drift at the post-upload rate.
      const sizePerEpoch =
        (basePricing.storagePerTibPerMonth * 100n * 1024n * 1024n) /
        ((1n << 40n) * basePricing.epochsPerMonth)
      const datasetFeePerEpoch = basePricing.datasetFeePerMonth /
        basePricing.epochsPerMonth
      const newRailRate = sizePerEpoch + datasetFeePerEpoch
      const netRate = drainingRate + newRailRate
      const driftCost = netRate * DEFAULT_BUFFER_EPOCHS
      const projectedAvail = scenario.availableFunds + after - driftCost
      expect(projectedAvail >= DEFAULT_NEW_DATASET_FIXED_FUNDS).toBe(true)
    })

    it('does not over-deposit when availableFunds is comfortably above the floor', () => {
      const deposit = calculateDepositNeeded({
        ...basePricing,
        dataSize: 100n * 1024n * 1024n,
        currentDataSetSize: 0n,
        isNewDataSet: true,
        currentLockupRate: drainingRate,
        debt: 0n,
        availableFunds: 10_000_000_000_000_000_000n,
        fundedUntilEpoch: 6_500_000n,
        currentEpoch: 6_032_000n,
        availableFundsFloor: DEFAULT_NEW_DATASET_FIXED_FUNDS,
      })
      expect(deposit).toBe(0n)
    })

    it('floor is skipped (correctly) when skipBuffer applies', () => {
      // Fresh account: currentLockupRate === 0 && isNewDataSet → skipBuffer.
      const deposit = calculateDepositNeeded({
        ...basePricing,
        dataSize: 100n * 1024n * 1024n,
        currentDataSetSize: 0n,
        isNewDataSet: true,
        currentLockupRate: 0n,
        debt: 0n,
        availableFunds: 0n,
        fundedUntilEpoch: 0n,
        currentEpoch: 6_032_000n,
        availableFundsFloor: DEFAULT_NEW_DATASET_FIXED_FUNDS,
      })
      // Should match lockup.total = rate lockup + lifecycle reserve +
      // creation fee.
      const sizePerEpoch =
        (basePricing.storagePerTibPerMonth * 100n * 1024n * 1024n) /
        ((1n << 40n) * basePricing.epochsPerMonth)
      const datasetFeePerEpoch = basePricing.datasetFeePerMonth /
        basePricing.epochsPerMonth
      const newRailRate = sizePerEpoch + datasetFeePerEpoch
      const expected = newRailRate * 86_400n + LIFECYCLE_RESERVE_TARGET +
        CREATE_DATA_SET_FEE
      expect(deposit).toBe(expected)
    })

    it('floor combines with existing runway buffer (takes the larger)', () => {
      // availableFunds just above lockup.total (~0.149) so no streaming
      // deposit is needed (rawDepositNeeded <= 0 → runway branch), but the
      // account expires within the buffer window AND a high drain rate means
      // bufferEpochs of drift would breach the 0.125 fixed-funds floor.
      const lockupTotal = 149_238_418_579_020_800n // 100 MiB new dataset
      const availableFunds = lockupTotal + 1_000n
      const lockupRate = 6_000_000_000_000_000n // 0.006 USDFC/epoch

      const scenario = {
        ...basePricing,
        dataSize: 100n * 1024n * 1024n,
        currentDataSetSize: 0n,
        isNewDataSet: true,
        currentLockupRate: lockupRate,
        debt: 0n,
        availableFunds,
        fundedUntilEpoch: 6_032_000n + 3n, // expires within buffer
        currentEpoch: 6_032_000n,
      }
      const withFloor = calculateDepositNeeded({
        ...scenario,
        availableFundsFloor: DEFAULT_NEW_DATASET_FIXED_FUNDS,
      })
      const withoutFloor = calculateDepositNeeded(scenario)
      expect(withFloor > withoutFloor).toBe(true)
    })

    it('add-pieces flows are untouched (no floor parameter)', () => {
      const deposit = calculateDepositNeeded({
        ...basePricing,
        dataSize: 100n * 1024n * 1024n,
        currentDataSetSize: 100n * 1024n * 1024n,
        isNewDataSet: false,
        currentLockupRate: drainingRate,
        debt: 0n,
        availableFunds: 100n, // basically zero
        fundedUntilEpoch: 6_032_000n + 50n,
        currentEpoch: 6_032_000n,
        // No availableFundsFloor — mirrors getUploadCosts behavior.
      })
      // No fixed funds locked on add-pieces, so the deposit stays well below
      // the new-dataset fixed cost.
      expect(deposit < DEFAULT_NEW_DATASET_FIXED_FUNDS).toBe(true)
    })
  })
})

describe('calculateBufferAmount with availableFundsFloor', () => {
  const base = {
    netRateAfterUpload: 19_444_444_444_432n,
    fundedUntilEpoch: 6_040_000n,
    currentEpoch: 6_032_000n,
    bufferEpochs: 5n,
  }

  it('returns 0n when floor is omitted and account is well-funded', () => {
    const buffer = calculateBufferAmount({
      ...base,
      rawDepositNeeded: -1_000_000_000_000_000_000n,
      availableFunds: 5_000_000_000_000_000_000n,
    })
    expect(buffer).toBe(0n)
  })

  it('top-ups the buffer when availableFunds drifts below floor', () => {
    const buffer = calculateBufferAmount({
      ...base,
      rawDepositNeeded: -1n,
      availableFunds: DEFAULT_NEW_DATASET_FIXED_FUNDS + 1n,
      availableFundsFloor: DEFAULT_NEW_DATASET_FIXED_FUNDS,
    })
    const expected = DEFAULT_NEW_DATASET_FIXED_FUNDS +
      base.netRateAfterUpload * base.bufferEpochs -
      (DEFAULT_NEW_DATASET_FIXED_FUNDS + 1n)
    expect(buffer).toBe(expected)
  })

  it('floor is no-op when availableFunds already covers drift', () => {
    const slack = 100n
    const availableFunds = DEFAULT_NEW_DATASET_FIXED_FUNDS +
      base.netRateAfterUpload * base.bufferEpochs + slack
    const buffer = calculateBufferAmount({
      ...base,
      rawDepositNeeded: -1n,
      availableFunds,
      availableFundsFloor: DEFAULT_NEW_DATASET_FIXED_FUNDS,
    })
    expect(buffer).toBe(0n)
  })

  it('floor takes max with the existing-runway buffer', () => {
    const buffer = calculateBufferAmount({
      ...base,
      fundedUntilEpoch: 6_032_002n, // within 5 of currentEpoch
      rawDepositNeeded: -1n,
      availableFunds: DEFAULT_NEW_DATASET_FIXED_FUNDS / 2n,
      availableFundsFloor: DEFAULT_NEW_DATASET_FIXED_FUNDS,
    })

    const legacy = base.netRateAfterUpload * base.bufferEpochs -
      DEFAULT_NEW_DATASET_FIXED_FUNDS / 2n
    const floor = DEFAULT_NEW_DATASET_FIXED_FUNDS +
      base.netRateAfterUpload * base.bufferEpochs -
      DEFAULT_NEW_DATASET_FIXED_FUNDS / 2n
    expect(buffer).toBe(floor > legacy ? floor : legacy)
    expect(buffer).toBe(floor)
  })
})

import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import {
  DEFAULT_BUFFER_EPOCHS,
  DEFAULT_MINIMUM_NEW_DATASET_LOCKUP,
  TIME_CONSTANTS,
  USDFC_SYBIL_FEE,
} from '../utils/constants.ts'
import {
  calculateBufferAmount,
  calculateDepositNeeded,
} from './calculate-deposit-needed.ts'

const basePricing = {
  pricePerTiBPerMonth: 5_000_000_000_000_000_000n,
  minimumPricePerMonth: 60_000_000_000_000_000n,
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
    // Equals lockup.total exactly (no buffer)
    // For this size it's floored: rate = floor/epochsPerMonth → small
    // The exact assertion: deposit > 0n, no extra rate*5 padding.
    const sybilContribution = USDFC_SYBIL_FEE
    expect(deposit >= sybilContribution).toBe(true)
  })

  it('adds buffer when an existing rail is draining', () => {
    // Mirrors the failing-run scenario shape.
    const currentLockupRate = 2_777_777_777_776n
    const deposit = calculateDepositNeeded({
      ...basePricing,
      dataSize: 1n << 20n,
      currentDataSetSize: 0n,
      isNewDataSet: true,
      currentLockupRate,
      debt: 0n,
      availableFunds: 159_894_444_444_444_512n, // matches the failed log
      fundedUntilEpoch: 1_000_000_000n,
      currentEpoch: 5_960_000n,
    })
    // Buffer contribution = (currentRate + rateDelta) * DEFAULT_BUFFER_EPOCHS
    // We can't compute exactly without re-running calculateAdditionalLockupRequired,
    // but the deposit must be strictly greater than the unbuffered amount.
    const unbuffered = calculateDepositNeeded({
      ...basePricing,
      dataSize: 1n << 20n,
      currentDataSetSize: 0n,
      isNewDataSet: true,
      currentLockupRate,
      debt: 0n,
      availableFunds: 159_894_444_444_444_512n,
      fundedUntilEpoch: 1_000_000_000n,
      currentEpoch: 5_960_000n,
      bufferEpochs: 0n,
    })
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
      availableFunds: 10_000_000_000_000_000_000n, // 10 USDFC, way more than needed
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

  // Regression: walletbeat-beta InsufficientLockupFunds (Filecoin mainnet).
  // Decoded revert showed availableFunds ~= 0.16 USDFC at getUploadCosts read
  // time, but on-chain availableFunds < 0.16 by the time createDataSet
  // executed, because the legacy buffer logic only triggers when
  // fundedUntilEpoch is within bufferEpochs. With ~28 minimum-rate rails
  // (lockupRate = 19444444444432 wei/epoch) the runway was thousands of
  // epochs away, so buffer = 0 even though availableFunds was right at the
  // FWSS `validatePayerOperatorApprovalAndFunds` floor.
  describe('on-chain availableFunds floor (DEFAULT_MINIMUM_NEW_DATASET_LOCKUP)', () => {
    // Mainnet pricing: 2.5 USDFC/TiB/month, 0.06 USDFC/month floor.
    const mainnetPricing = {
      pricePerTiBPerMonth: 2_500_000_000_000_000_000n,
      minimumPricePerMonth: 60_000_000_000_000_000n,
      epochsPerMonth: TIME_CONSTANTS.EPOCHS_PER_MONTH,
    }
    // Drain rate for the walletbeat-beta account at time of failure (28 min rails).
    const mainnetLockupRate = 19_444_444_444_432n

    it('forces a non-zero deposit when availableFunds is just barely above the floor', () => {
      // availableFunds = floor + 10 wei (tiny excess that any drift eats).
      // fundedUntilEpoch is thousands of epochs out, so the legacy
      // runway-based buffer returns 0n.
      const before = calculateDepositNeeded({
        ...mainnetPricing,
        dataSize: 100n * 1024n * 1024n,
        currentDataSetSize: 0n,
        isNewDataSet: true,
        currentLockupRate: mainnetLockupRate,
        debt: 0n,
        availableFunds: DEFAULT_MINIMUM_NEW_DATASET_LOCKUP + 10n,
        fundedUntilEpoch: 6_040_000n, // far in the future
        currentEpoch: 6_032_000n,
        // No floor: reproduces the bug.
      })
      expect(before).toBe(0n)

      const after = calculateDepositNeeded({
        ...mainnetPricing,
        dataSize: 100n * 1024n * 1024n,
        currentDataSetSize: 0n,
        isNewDataSet: true,
        currentLockupRate: mainnetLockupRate,
        debt: 0n,
        availableFunds: DEFAULT_MINIMUM_NEW_DATASET_LOCKUP + 10n,
        fundedUntilEpoch: 6_040_000n,
        currentEpoch: 6_032_000n,
        availableFundsFloor: DEFAULT_MINIMUM_NEW_DATASET_LOCKUP,
      })

      // Sanity: depositing `after` must leave availableFunds ≥ floor after
      // up to bufferEpochs of drift at the post-upload rate.
      // The new rail charges the minimum rate (size below floor), so:
      const newRailRate = mainnetPricing.minimumPricePerMonth /
        TIME_CONSTANTS.EPOCHS_PER_MONTH
      const netRate = mainnetLockupRate + newRailRate
      const driftCost = netRate * DEFAULT_BUFFER_EPOCHS
      const projectedAvail = DEFAULT_MINIMUM_NEW_DATASET_LOCKUP + 10n + after -
        driftCost
      expect(projectedAvail >= DEFAULT_MINIMUM_NEW_DATASET_LOCKUP).toBe(true)
    })

    it('does not over-deposit when availableFunds is comfortably above the floor', () => {
      // 10 USDFC available — plenty of headroom.
      const deposit = calculateDepositNeeded({
        ...mainnetPricing,
        dataSize: 100n * 1024n * 1024n,
        currentDataSetSize: 0n,
        isNewDataSet: true,
        currentLockupRate: mainnetLockupRate,
        debt: 0n,
        availableFunds: 10_000_000_000_000_000_000n,
        fundedUntilEpoch: 6_500_000n,
        currentEpoch: 6_032_000n,
        availableFundsFloor: DEFAULT_MINIMUM_NEW_DATASET_LOCKUP,
      })
      expect(deposit).toBe(0n)
    })

    it('floor is skipped (correctly) when skipBuffer applies', () => {
      // Fresh account: currentLockupRate === 0 && isNewDataSet → skipBuffer.
      // No rails draining means no risk of drift below the floor before tx
      // execution — the deposit itself supplies the funds.
      const deposit = calculateDepositNeeded({
        ...mainnetPricing,
        dataSize: 100n * 1024n * 1024n,
        currentDataSetSize: 0n,
        isNewDataSet: true,
        currentLockupRate: 0n,
        debt: 0n,
        availableFunds: 0n,
        fundedUntilEpoch: 0n,
        currentEpoch: 6_032_000n,
        availableFundsFloor: DEFAULT_MINIMUM_NEW_DATASET_LOCKUP,
      })
      // Should match lockup.total = DEFAULT_MINIMUM_NEW_DATASET_LOCKUP (within
      // floor-rounding caused by the contract's two-factor division).
      const newRailRate = mainnetPricing.minimumPricePerMonth /
        TIME_CONSTANTS.EPOCHS_PER_MONTH
      const expected = newRailRate * 86_400n + USDFC_SYBIL_FEE
      expect(deposit).toBe(expected)
    })

    it('floor combines with existing runway buffer (takes the larger)', () => {
      // Account expires within the buffer window AND has low availableFunds.
      // The legacy runway buffer would supply `rate * 5 - availableFunds`.
      // The floor would supply `floor + rate * 5 - availableFunds - clampedRaw`.
      // The latter is larger by exactly `floor - 0` (since clampedRaw matches
      // when rawDepositNeeded > 0 the floor case is subsumed; this scenario
      // tests the rawDepositNeeded <= 0n branch).
      const availableFunds = DEFAULT_MINIMUM_NEW_DATASET_LOCKUP + 1_000n // tiny excess
      const lockupRate = 1_000_000_000_000n // higher per-epoch drain (3.6 USDFC/month-ish)

      const withFloor = calculateDepositNeeded({
        ...mainnetPricing,
        dataSize: 100n * 1024n * 1024n,
        currentDataSetSize: 0n,
        isNewDataSet: true,
        currentLockupRate: lockupRate,
        debt: 0n,
        availableFunds,
        fundedUntilEpoch: 6_032_000n + 3n, // expires in 3 epochs — within buffer
        currentEpoch: 6_032_000n,
        availableFundsFloor: DEFAULT_MINIMUM_NEW_DATASET_LOCKUP,
      })
      const withoutFloor = calculateDepositNeeded({
        ...mainnetPricing,
        dataSize: 100n * 1024n * 1024n,
        currentDataSetSize: 0n,
        isNewDataSet: true,
        currentLockupRate: lockupRate,
        debt: 0n,
        availableFunds,
        fundedUntilEpoch: 6_032_000n + 3n,
        currentEpoch: 6_032_000n,
      })
      expect(withFloor > withoutFloor).toBe(true)
    })

    it('add-pieces flows are untouched (no floor parameter)', () => {
      // No new rail created → no on-chain floor check → no protection needed.
      const deposit = calculateDepositNeeded({
        ...mainnetPricing,
        dataSize: 100n * 1024n * 1024n,
        currentDataSetSize: 100n * 1024n * 1024n,
        isNewDataSet: false,
        currentLockupRate: mainnetLockupRate,
        debt: 0n,
        availableFunds: 100n, // basically zero
        fundedUntilEpoch: 6_032_000n + 50n,
        currentEpoch: 6_032_000n,
        // No availableFundsFloor — mirrors getUploadCosts behavior.
      })
      // The size delta from doubling 100 MiB stays below the floor, so the
      // rate delta is 0 — no new lockup needed beyond drift.
      // Without a floor we just return the legacy runway buffer.
      expect(deposit < DEFAULT_MINIMUM_NEW_DATASET_LOCKUP).toBe(true)
    })
  })
})

describe('calculateBufferAmount with availableFundsFloor', () => {
  // Base scenario shared across cases.
  const base = {
    netRateAfterUpload: 19_444_444_444_432n, // 28-rail drain
    fundedUntilEpoch: 6_040_000n, // way past bufferEpochs window
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
    // availableFunds = floor + 1 wei
    const buffer = calculateBufferAmount({
      ...base,
      rawDepositNeeded: -1n,
      availableFunds: DEFAULT_MINIMUM_NEW_DATASET_LOCKUP + 1n,
      availableFundsFloor: DEFAULT_MINIMUM_NEW_DATASET_LOCKUP,
    })
    // Expected: floor + netRate*buffer - availableFunds - 0 (clampedRaw=0)
    const expected = DEFAULT_MINIMUM_NEW_DATASET_LOCKUP +
      base.netRateAfterUpload * base.bufferEpochs -
      (DEFAULT_MINIMUM_NEW_DATASET_LOCKUP + 1n)
    expect(buffer).toBe(expected)
  })

  it('floor is no-op when availableFunds already covers drift', () => {
    // availableFunds = floor + drift_cost + slack
    const slack = 100n
    const availableFunds = DEFAULT_MINIMUM_NEW_DATASET_LOCKUP +
      base.netRateAfterUpload * base.bufferEpochs + slack
    const buffer = calculateBufferAmount({
      ...base,
      rawDepositNeeded: -1n,
      availableFunds,
      availableFundsFloor: DEFAULT_MINIMUM_NEW_DATASET_LOCKUP,
    })
    expect(buffer).toBe(0n)
  })

  it('floor takes max with the existing-runway buffer', () => {
    // Account expires within bufferEpochs (legacy branch triggers), AND
    // availableFunds < floor + drift. Result is the larger of the two.
    const buffer = calculateBufferAmount({
      ...base,
      fundedUntilEpoch: 6_032_002n, // within 5 of currentEpoch
      rawDepositNeeded: -1n,
      availableFunds: DEFAULT_MINIMUM_NEW_DATASET_LOCKUP / 2n,
      availableFundsFloor: DEFAULT_MINIMUM_NEW_DATASET_LOCKUP,
    })

    const legacy = base.netRateAfterUpload * base.bufferEpochs -
      DEFAULT_MINIMUM_NEW_DATASET_LOCKUP / 2n
    const floor = DEFAULT_MINIMUM_NEW_DATASET_LOCKUP +
      base.netRateAfterUpload * base.bufferEpochs -
      DEFAULT_MINIMUM_NEW_DATASET_LOCKUP / 2n
    expect(buffer).toBe(floor > legacy ? floor : legacy)
    // floor should win here since DEFAULT_MINIMUM_NEW_DATASET_LOCKUP > 0.
    expect(buffer).toBe(floor)
  })
})

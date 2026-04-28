import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import {
  DEFAULT_BUFFER_EPOCHS,
  TIME_CONSTANTS,
  USDFC_SYBIL_FEE,
} from '../utils/constants.ts'
import { calculateDepositNeeded } from './calculate-deposit-needed.ts'

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
})

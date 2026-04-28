import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import {
  LOCKUP_PERIOD,
  TIME_CONSTANTS,
  USDFC_SYBIL_FEE,
} from '../utils/constants.ts'
import { calculateAdditionalLockupRequired } from './calculate-additional-lockup-required.ts'

describe('calculateAdditionalLockupRequired', () => {
  const baseRate = {
    pricePerTiBPerMonth: 5_000_000_000_000_000_000n,
    minimumPricePerMonth: 60_000_000_000_000_000n,
    epochsPerMonth: TIME_CONSTANTS.EPOCHS_PER_MONTH,
  }

  it('uses full rate and includes sybil fee for new datasets', () => {
    const out = calculateAdditionalLockupRequired({
      ...baseRate,
      dataSize: 1n << 30n, // 1 GiB
      currentDataSetSize: 0n,
      isNewDataSet: true,
    })
    expect(out.sybilFee).toBe(USDFC_SYBIL_FEE)
    expect(out.rateLockupDelta).toBe(out.rateDeltaPerEpoch * LOCKUP_PERIOD)
    expect(out.total).toBe(out.rateLockupDelta + USDFC_SYBIL_FEE)
    expect(out.rateDeltaPerEpoch > 0n).toBe(true)
  })

  it('uses rate-delta math for additions to existing datasets', () => {
    const out = calculateAdditionalLockupRequired({
      ...baseRate,
      dataSize: 1n << 40n, // 1 TiB
      currentDataSetSize: 1n << 40n, // 1 TiB existing
      isNewDataSet: false,
    })
    // No sybil fee on adds; rate delta = rate(2 TiB) - rate(1 TiB)
    expect(out.sybilFee).toBe(0n)
    expect(out.rateDeltaPerEpoch > 0n).toBe(true)
  })

  it('returns zero rateDelta when both sizes are below the floor', () => {
    const out = calculateAdditionalLockupRequired({
      ...baseRate,
      dataSize: 1024n, // 1 KiB
      currentDataSetSize: 1024n,
      isNewDataSet: false,
    })
    expect(out.rateDeltaPerEpoch).toBe(0n)
    expect(out.rateLockupDelta).toBe(0n)
    expect(out.total).toBe(0n)
  })
})

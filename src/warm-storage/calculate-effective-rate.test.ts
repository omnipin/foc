import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import { SIZE_CONSTANTS, TIME_CONSTANTS } from '../utils/constants.ts'
import { calculateEffectiveRate } from './calculate-effective-rate.ts'

describe('calculateEffectiveRate', () => {
  const epochsPerMonth = TIME_CONSTANTS.EPOCHS_PER_MONTH
  const pricePerTiBPerMonth = 5_000_000_000_000_000_000n // 5 USDFC/TiB/mo
  const minimumPricePerMonth = 60_000_000_000_000_000n // 0.06 USDFC/mo floor

  it('floors small dataset rates to the minimum', () => {
    const out = calculateEffectiveRate({
      sizeInBytes: 1n << 20n, // 1 MiB
      pricePerTiBPerMonth,
      minimumPricePerMonth,
      epochsPerMonth,
    })
    expect(out.ratePerMonth).toBe(minimumPricePerMonth)
    expect(out.ratePerEpoch).toBe(minimumPricePerMonth / epochsPerMonth)
  })

  it('uses linear pricing above the floor', () => {
    // 1 TiB → 5 USDFC/mo (above floor)
    const out = calculateEffectiveRate({
      sizeInBytes: SIZE_CONSTANTS.TiB,
      pricePerTiBPerMonth,
      minimumPricePerMonth,
      epochsPerMonth,
    })
    expect(out.ratePerMonth).toBe(pricePerTiBPerMonth)
    expect(out.ratePerEpoch).toBe(pricePerTiBPerMonth / epochsPerMonth)
  })

  it('matches contract single-step truncation for ratePerEpoch', () => {
    // ratePerEpoch = (sizeInBytes * pricePerTiBPerMonth) / (TiB * epochsPerMonth)
    // for 1.5 TiB, both natural divisions truncate slightly differently
    const sizeInBytes = SIZE_CONSTANTS.TiB + SIZE_CONSTANTS.TiB / 2n
    const out = calculateEffectiveRate({
      sizeInBytes,
      pricePerTiBPerMonth,
      minimumPricePerMonth,
      epochsPerMonth,
    })
    const expectedPerEpoch = (pricePerTiBPerMonth * sizeInBytes) /
      (SIZE_CONSTANTS.TiB * epochsPerMonth)
    expect(out.ratePerEpoch).toBe(expectedPerEpoch)
  })
})

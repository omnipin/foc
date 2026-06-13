import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import { SIZE_CONSTANTS, TIME_CONSTANTS } from '../utils/constants.ts'
import { calculateEffectiveRate } from './calculate-effective-rate.ts'

describe('calculateEffectiveRate', () => {
  const epochsPerMonth = TIME_CONSTANTS.EPOCHS_PER_MONTH
  const storagePerTibPerMonth = 2_500_000_000_000_000_000n // 2.5 USDFC/TiB/mo
  const datasetFeePerMonth = 24_000_000_000_000_000n // 0.024 USDFC/mo flat fee
  const datasetFeePerEpoch = datasetFeePerMonth / epochsPerMonth

  it('returns a zero rate for an empty dataset', () => {
    const out = calculateEffectiveRate({
      sizeInBytes: 0n,
      storagePerTibPerMonth,
      datasetFeePerMonth,
      epochsPerMonth,
    })
    expect(out.ratePerMonth).toBe(0n)
    expect(out.ratePerEpoch).toBe(0n)
  })

  it('adds the flat dataset fee to a tiny size-proportional rate', () => {
    const sizeInBytes = 1n << 20n // 1 MiB
    const out = calculateEffectiveRate({
      sizeInBytes,
      storagePerTibPerMonth,
      datasetFeePerMonth,
      epochsPerMonth,
    })
    const sizePerMonth = (storagePerTibPerMonth * sizeInBytes) /
      SIZE_CONSTANTS.TiB
    const sizePerEpoch = (storagePerTibPerMonth * sizeInBytes) /
      (SIZE_CONSTANTS.TiB * epochsPerMonth)
    expect(out.ratePerMonth).toBe(sizePerMonth + datasetFeePerMonth)
    expect(out.ratePerEpoch).toBe(sizePerEpoch + datasetFeePerEpoch)
  })

  it('uses linear size pricing plus the flat fee at 1 TiB', () => {
    const out = calculateEffectiveRate({
      sizeInBytes: SIZE_CONSTANTS.TiB,
      storagePerTibPerMonth,
      datasetFeePerMonth,
      epochsPerMonth,
    })
    expect(out.ratePerMonth).toBe(storagePerTibPerMonth + datasetFeePerMonth)
    expect(out.ratePerEpoch).toBe(
      storagePerTibPerMonth / epochsPerMonth + datasetFeePerEpoch,
    )
  })

  it('matches contract single-step truncation for the size term', () => {
    // sizePerEpoch = (sizeInBytes * storagePerTibPerMonth) / (TiB * epochsPerMonth)
    const sizeInBytes = SIZE_CONSTANTS.TiB + SIZE_CONSTANTS.TiB / 2n
    const out = calculateEffectiveRate({
      sizeInBytes,
      storagePerTibPerMonth,
      datasetFeePerMonth,
      epochsPerMonth,
    })
    const expectedSizePerEpoch = (storagePerTibPerMonth * sizeInBytes) /
      (SIZE_CONSTANTS.TiB * epochsPerMonth)
    expect(out.ratePerEpoch).toBe(expectedSizePerEpoch + datasetFeePerEpoch)
  })

  it('defaults epochsPerMonth to the time constant', () => {
    const withDefault = calculateEffectiveRate({
      sizeInBytes: SIZE_CONSTANTS.TiB,
      storagePerTibPerMonth,
      datasetFeePerMonth,
    })
    const explicit = calculateEffectiveRate({
      sizeInBytes: SIZE_CONSTANTS.TiB,
      storagePerTibPerMonth,
      datasetFeePerMonth,
      epochsPerMonth,
    })
    expect(withDefault).toEqual(explicit)
  })
})

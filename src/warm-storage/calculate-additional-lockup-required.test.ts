import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import {
  CREATE_DATA_SET_FEE,
  LIFECYCLE_RESERVE_TARGET,
  LOCKUP_PERIOD,
  TIME_CONSTANTS,
} from '../utils/constants.ts'
import { calculateAdditionalLockupRequired } from './calculate-additional-lockup-required.ts'

describe('calculateAdditionalLockupRequired', () => {
  const baseRate = {
    storagePerTibPerMonth: 2_500_000_000_000_000_000n,
    datasetFeePerMonth: 24_000_000_000_000_000n,
    epochsPerMonth: TIME_CONSTANTS.EPOCHS_PER_MONTH,
  }

  it('includes lifecycle reserve + creation fee for new datasets', () => {
    const out = calculateAdditionalLockupRequired({
      ...baseRate,
      dataSize: 1n << 30n, // 1 GiB
      currentDataSetSize: 0n,
      isNewDataSet: true,
    })
    expect(out.lifecycleReserve).toBe(LIFECYCLE_RESERVE_TARGET)
    expect(out.createDataSetFee).toBe(CREATE_DATA_SET_FEE)
    expect(out.rateLockupDelta).toBe(out.rateDeltaPerEpoch * LOCKUP_PERIOD)
    expect(out.total).toBe(
      out.rateLockupDelta + LIFECYCLE_RESERVE_TARGET + CREATE_DATA_SET_FEE,
    )
    expect(out.rateDeltaPerEpoch > 0n).toBe(true)
  })

  it('uses rate-delta math with no fixed fees for additions', () => {
    const out = calculateAdditionalLockupRequired({
      ...baseRate,
      dataSize: 1n << 40n, // 1 TiB
      currentDataSetSize: 1n << 40n, // 1 TiB existing
      isNewDataSet: false,
    })
    // No lifecycle reserve or creation fee on adds.
    expect(out.lifecycleReserve).toBe(0n)
    expect(out.createDataSetFee).toBe(0n)
    expect(out.total).toBe(out.rateLockupDelta)
    expect(out.rateDeltaPerEpoch > 0n).toBe(true)
  })

  it('the flat dataset fee does not change the delta when adding to a dataset', () => {
    // The flat datasetFeePerMonth term cancels in (new - current) for an
    // existing non-empty dataset, so the delta is purely size-proportional.
    const out = calculateAdditionalLockupRequired({
      ...baseRate,
      dataSize: 1n << 40n,
      currentDataSetSize: 1n << 40n,
      isNewDataSet: false,
    })
    const sizeOnlyDelta = (baseRate.storagePerTibPerMonth * (1n << 40n)) /
      ((1n << 40n) * baseRate.epochsPerMonth)
    expect(out.rateDeltaPerEpoch).toBe(sizeOnlyDelta)
  })

  it('honors custom lifecycle reserve / creation fee overrides', () => {
    const out = calculateAdditionalLockupRequired({
      ...baseRate,
      dataSize: 1n << 30n,
      currentDataSetSize: 0n,
      isNewDataSet: true,
      lifecycleReserveTarget: 1n,
      createDataSetFee: 2n,
    })
    expect(out.lifecycleReserve).toBe(1n)
    expect(out.createDataSetFee).toBe(2n)
    expect(out.total).toBe(out.rateLockupDelta + 3n)
  })
})

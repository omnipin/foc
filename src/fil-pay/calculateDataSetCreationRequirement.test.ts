import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import {
  calculateDataSetCreationRequirement,
  DEFAULT_LOCKUP_PERIOD,
} from './calculateDataSetCreationRequirement.ts'

describe('calculateDataSetCreationRequirement', () => {
  it('should mirror the v1.2.0 creation floor math', () => {
    const result = calculateDataSetCreationRequirement({
      minimumPricePerMonth: 60_000_000_000_000_000n,
      sybilFee: 100_000_000_000_000_000n,
    })

    expect(result).toEqual({
      defaultLockupPeriod: DEFAULT_LOCKUP_PERIOD,
      epochsPerMonth: DEFAULT_LOCKUP_PERIOD,
      minimumLockupRequired: 60_000_000_000_000_000n,
      creationRequirement: 160_000_000_000_000_000n,
    })
  })
})

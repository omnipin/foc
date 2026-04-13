import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import { filecoinCalibration, filecoinMainnet } from '../utils/constants.ts'
import { DEFAULT_LOCKUP_PERIOD } from './calculateDataSetCreationRequirement.ts'
import { getDataSetCreationRequirements } from './getDataSetCreationRequirements.ts'

describe('getDataSetCreationRequirements', () => {
  it('should return the live dataset creation requirement on mainnet', async () => {
    const requirements = await getDataSetCreationRequirements({
      chain: filecoinMainnet,
    })

    expect(requirements.defaultLockupPeriod).toBe(DEFAULT_LOCKUP_PERIOD)
    expect(requirements.epochsPerMonth).toBe(DEFAULT_LOCKUP_PERIOD)
    expect(requirements.minimumPricePerMonth > 0n).toBe(true)
    expect(requirements.minimumLockupRequired).toBe(
      requirements.minimumPricePerMonth,
    )
    expect(requirements.sybilFee).toBe(100_000_000_000_000_000n)
    expect(requirements.creationRequirement).toBe(
      requirements.minimumPricePerMonth + requirements.sybilFee,
    )
    expect(requirements.pdpVerifierAddress.toLowerCase()).toBe(
      filecoinMainnet.contracts.pdpVerifier.address.toLowerCase(),
    )
  })

  it('should return the live dataset creation requirement on calibration', async () => {
    const requirements = await getDataSetCreationRequirements({
      chain: filecoinCalibration,
    })

    expect(requirements.defaultLockupPeriod).toBe(DEFAULT_LOCKUP_PERIOD)
    expect(requirements.epochsPerMonth).toBe(DEFAULT_LOCKUP_PERIOD)
    expect(requirements.minimumPricePerMonth > 0n).toBe(true)
    expect(requirements.minimumLockupRequired).toBe(
      requirements.minimumPricePerMonth,
    )
    expect(requirements.sybilFee).toBe(100_000_000_000_000_000n)
    expect(requirements.creationRequirement).toBe(
      requirements.minimumPricePerMonth + requirements.sybilFee,
    )
    expect(requirements.pdpVerifierAddress.toLowerCase()).toBe(
      filecoinCalibration.contracts.pdpVerifier.address.toLowerCase(),
    )
  })
})

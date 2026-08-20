import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import { filecoinCalibration, filecoinMainnet } from '../utils/constants.ts'
import { getApprovedSPs } from './getApprovedSPs.ts'

// The approved-SP registry is live state and keeps changing (mainnet gained
// SP 32, calibration dropped SP 5), so assert invariants and a long-lived
// anchor SP instead of pinning the exact set.
describe('getApprovedSPs', () => {
  it('should work on mainnet', async () => {
    const { providerIds, providerCount } = await getApprovedSPs({
      chain: filecoinMainnet,
    })
    expect(providerCount).toEqual(BigInt(providerIds.length))
    expect(providerIds.length).toBeGreaterThan(0)
    expect(providerIds).toContain(1n)
  })
  it('should work on testnet', async () => {
    const { providerIds, providerCount } = await getApprovedSPs({
      chain: filecoinCalibration,
    })
    expect(providerCount).toEqual(BigInt(providerIds.length))
    expect(providerIds.length).toBeGreaterThan(0)
    expect(providerIds).toContain(2n)
  })
})

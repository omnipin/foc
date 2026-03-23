import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import { filecoinCalibration, filecoinMainnet } from '../utils/constants.ts'
import { getApprovedSPs } from './getApprovedSPs.ts'

describe('getApprovedSPs', () => {
  it('should work on mainnet', async () => {
    const { providerIds, providerCount } = await getApprovedSPs({
      chain: filecoinMainnet,
    })
    expect(providerIds).toEqual([1n, 5n, 7n])
    expect(providerCount).toEqual(3n)
  })
  it('should work on testnet', async () => {
    const { providerIds, providerCount } = await getApprovedSPs({
      chain: filecoinCalibration,
    })
    expect(providerIds).toEqual([
      2n,
      5n,
      4n,
      9n,
    ])
    expect(providerCount).toEqual(4n)
  })
})

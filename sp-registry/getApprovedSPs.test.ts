import { describe, expect, it } from 'bun:test'
import { filecoinCalibration, filecoinMainnet } from '../utils/constants'
import { getApprovedSPs } from './getApprovedSPs'

describe('getApprovedSPs', () => {
  it('should work on mainnet', async () => {
    const { providerIds, providerCount } = await getApprovedSPs({
      chain: filecoinMainnet,
    })
    expect(providerIds).toMatchInlineSnapshot(`
      [
        1n,
        5n,
      ]
    `)
    expect(providerCount).toMatchInlineSnapshot(`2n`)
  })
  it('should work on testnet', async () => {
    const { providerIds, providerCount } = await getApprovedSPs({
      chain: filecoinCalibration,
    })
    expect(providerIds).toMatchInlineSnapshot(`
      [
        2n,
        5n,
        4n,
        9n,
      ]
    `)
    expect(providerCount).toMatchInlineSnapshot(`4n`)
  })
})

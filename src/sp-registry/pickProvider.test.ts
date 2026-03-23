import { describe, expect, it } from 'bun:test'
import { fromPublicKey } from 'ox/Address'
import { getPublicKey, randomPrivateKey } from 'ox/Secp256k1'
import { filecoinMainnet } from '../utils/constants'
import { pickProvider } from './pickProvider'

describe('pickProvider', () => {
  it('should choose a random SP that has not uploaded anything yet', async () => {
    const providerId = await pickProvider({
      chain: filecoinMainnet,
      address: fromPublicKey(getPublicKey({ privateKey: randomPrivateKey() })),
    })
    expect(providerId).toBeDefined()
  })
  it('should choose the SP with active client data set', async () => {
    const providerId = await pickProvider({
      chain: filecoinMainnet,
      address: '0x7d3f0ca48194490d7c8b60fea6225e817ec52aa9',
    })
    expect(providerId).toEqual(1n)
  })
  it('should return providerId for a specified providerAddress', async () => {
    const providerId = await pickProvider({
      chain: filecoinMainnet,
      providerAddress: '0x32c90c26bca6ed3945de9b29ba4e19d38314d618',
    })
    expect(providerId).toEqual(1n)
  })
})

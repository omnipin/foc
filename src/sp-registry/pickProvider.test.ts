import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import { fromPublicKey } from 'ox/Address'
import { getPublicKey, randomPrivateKey } from 'ox/Secp256k1'
import { getClientDataSets } from '../data-set/getClientDatasets.ts'
import { filecoinMainnet } from '../utils/constants.ts'
import { getApprovedSPs } from './getApprovedSPs.ts'
import { pickProvider } from './pickProvider.ts'

describe('pickProvider', () => {
  it('should choose a random SP that has not uploaded anything yet', async () => {
    const providerId = await pickProvider({
      chain: filecoinMainnet,
      address: fromPublicKey(getPublicKey({ privateKey: randomPrivateKey() })),
    })
    expect(providerId).toBeDefined()
  })
  it('should choose the SP with active client data set', async () => {
    const address = '0x7d3f0ca48194490d7c8b60fea6225e817ec52aa9'
    const providerId = await pickProvider({ chain: filecoinMainnet, address })

    // The chosen provider must be approved and have an active data set for
    // this client (state is mutable on-chain, so we don't pin a fixed id).
    const { providerIds } = await getApprovedSPs({ chain: filecoinMainnet })
    const activeProviderIds = (await getClientDataSets({
      address,
      chain: filecoinMainnet,
    }))
      .filter((ds) =>
        ds.pdpEndEpoch === 0n && providerIds.includes(ds.providerId)
      )
      .map((ds) => ds.providerId)

    expect(activeProviderIds).toContain(providerId)
  })
  it('should return providerId for a specified providerAddress', async () => {
    const providerId = await pickProvider({
      chain: filecoinMainnet,
      providerAddress: '0x32c90c26bca6ed3945de9b29ba4e19d38314d618',
    })
    expect(providerId).toEqual(1n)
  })
})

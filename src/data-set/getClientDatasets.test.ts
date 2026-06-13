import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import { filecoinMainnet } from '../utils/constants.ts'
import { getClientDataSets } from './getClientDatasets.ts'

describe('getClientDatasets', () => {
  it('should list client data sets for an Ethereum address', async () => {
    const datasets = await getClientDataSets({
      chain: filecoinMainnet,
      address: '0x7D3F0Ca48194490D7C8B60feA6225e817eC52AA9',
    })

    // The address keeps accruing data sets on-chain, so assert that the
    // known-stable entries are present rather than pinning the full list.
    const expected = [
      {
        pdpRailId: 17n,
        cacheMissRailId: 0n,
        cdnRailId: 0n,
        payer: '0x7d3f0ca48194490d7c8b60fea6225e817ec52aa9',
        payee: '0x32c90c26bca6ed3945de9b29ba4e19d38314d618',
        serviceProvider: '0x32c90c26bca6ed3945de9b29ba4e19d38314d618',
        commissionBps: 0n,
        clientDataSetId: 67314781n,
        pdpEndEpoch: 5583800n,
        providerId: 1n,
        pendingOneTimePayments: 0n,
        lifecycleReserveBalance: 0n,
        dataSetId: 9n,
      },
      {
        pdpRailId: 591n,
        cacheMissRailId: 0n,
        cdnRailId: 0n,
        payer: '0x7d3f0ca48194490d7c8b60fea6225e817ec52aa9',
        payee: '0x32c90c26bca6ed3945de9b29ba4e19d38314d618',
        serviceProvider: '0x32c90c26bca6ed3945de9b29ba4e19d38314d618',
        commissionBps: 0n,
        clientDataSetId: 79945734n,
        pdpEndEpoch: 0n,
        providerId: 1n,
        pendingOneTimePayments: 0n,
        lifecycleReserveBalance: 0n,
        dataSetId: 476n,
      },
    ]

    for (const want of expected) {
      const match = datasets.find((ds) => ds.dataSetId === want.dataSetId)
      expect(match).toEqual(want)
    }
  })
})

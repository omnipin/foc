import { describe, expect, it } from 'bun:test'
import { filecoinMainnet } from '../utils/constants'
import { getClientDataSets } from './getClientDatasets'

describe('getClientDatasets', () => {
  it('should list client data sets for an Ethereum address', async () => {
    const datasets = await getClientDataSets({
      chain: filecoinMainnet,
      address: '0x7D3F0Ca48194490D7C8B60feA6225e817eC52AA9',
    })

    expect(datasets).toEqual([
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
        dataSetId: 476n,
      },
    ])
  })
})

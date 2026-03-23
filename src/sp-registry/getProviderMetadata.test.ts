import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import { filecoinMainnet } from '../utils/constants.ts'

import { getProviderMetadata } from './getProviderMetadata.ts'

describe('getProviderMetadata', () => {
  it('should return a random provider ID from a list of approved SPs', async () => {
    const provider = await getProviderMetadata({
      chain: filecoinMainnet,
      providerId: 1n,
    })

    expect(provider).toEqual({
      'address': '0x32c90c26bca6ed3945de9b29ba4e19d38314d618',
      'serviceURL': 'https://main.ezpdpz.net',
    })
  })
})

import { decodeResult, encodeData } from 'ox/AbiFunction'
import { type FilecoinChain, filProvider } from '../utils/constants.ts'

const abi = {
  type: 'function',
  inputs: [],
  name: 'getServicePrice',
  outputs: [
    {
      name: 'pricing',
      internalType: 'struct FilecoinWarmStorageService.ServicePricing',
      type: 'tuple',
      components: [
        {
          name: 'pricePerTiBPerMonthNoCDN',
          internalType: 'uint256',
          type: 'uint256',
        },
        {
          name: 'pricePerTiBCdnEgress',
          internalType: 'uint256',
          type: 'uint256',
        },
        {
          name: 'pricePerTiBCacheMissEgress',
          internalType: 'uint256',
          type: 'uint256',
        },
        {
          name: 'tokenAddress',
          internalType: 'contract IERC20',
          type: 'address',
        },
        { name: 'epochsPerMonth', internalType: 'uint256', type: 'uint256' },
        {
          name: 'minimumPricePerMonth',
          internalType: 'uint256',
          type: 'uint256',
        },
      ],
    },
  ],
  stateMutability: 'view',
} as const

export type GetServicePricingOutput = {
  pricePerTiBPerMonthNoCDN: bigint
  pricePerTiBCdnEgress: bigint
  pricePerTiBCacheMissEgress: bigint
  tokenAddress: `0x${string}`
  epochsPerMonth: bigint
  minimumPricePerMonth: bigint
}

/**
 * Read raw service pricing from the FWSS storage contract.
 *
 * Mirrors `@filoz/synapse-core/warm-storage/getServicePrice` (returns the
 * full pricing struct, leaving derived rate calculations to
 * {@link calculateEffectiveRate}).
 */
export const getServicePricing = async ({
  chain,
}: {
  chain: FilecoinChain
}): Promise<GetServicePricingOutput> => {
  const provider = filProvider[chain.id]
  const result = await provider.request({
    method: 'eth_call',
    params: [
      {
        to: chain.contracts.storage.address,
        data: encodeData(abi),
      },
      'latest',
    ],
  })

  const pricing = decodeResult(abi, result)
  return pricing as GetServicePricingOutput
}

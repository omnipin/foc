import { decodeResult, encodeData } from 'ox/AbiFunction'
import { type Address } from 'ox/Address'
import { type FilecoinChain, filProvider } from '../utils/constants.ts'
import { calculateDataSetCreationRequirement } from './calculateDataSetCreationRequirement.ts'

const serviceAbi = [
  {
    type: 'function',
    name: 'getServicePrice',
    inputs: [],
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
  },
  {
    type: 'function',
    name: 'pdpVerifierAddress',
    inputs: [],
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
] as const

const pdpVerifierAbi = {
  type: 'function',
  name: 'USDFC_SYBIL_FEE',
  inputs: [],
  outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
  stateMutability: 'view',
} as const

export const getDataSetCreationRequirements = async ({
  chain,
}: {
  chain: FilecoinChain
}) => {
  const provider = filProvider[chain.id]

  const [servicePriceResult, pdpVerifierResult] = await Promise.all([
    provider.request({
      method: 'eth_call',
      params: [
        {
          to: chain.contracts.storage.address,
          data: encodeData(serviceAbi[0]),
        },
        'latest',
      ],
    }),
    provider.request({
      method: 'eth_call',
      params: [
        {
          to: chain.contracts.storage.address,
          data: encodeData(serviceAbi[1]),
        },
        'latest',
      ],
    }),
  ])

  const { minimumPricePerMonth } = decodeResult(serviceAbi[0], servicePriceResult)
  const pdpVerifierAddress = decodeResult(serviceAbi[1], pdpVerifierResult)
  const verifierAddress = pdpVerifierAddress === '0x0000000000000000000000000000000000000000'
    ? chain.contracts.pdpVerifier.address
    : pdpVerifierAddress as Address

  const sybilFeeResult = await provider.request({
    method: 'eth_call',
    params: [
      {
        to: verifierAddress,
        data: encodeData(pdpVerifierAbi),
      },
      'latest',
    ],
  })

  const sybilFee = decodeResult(pdpVerifierAbi, sybilFeeResult)
  const requirements = calculateDataSetCreationRequirement({
    minimumPricePerMonth,
    sybilFee,
  })

  return {
    minimumPricePerMonth,
    pdpVerifierAddress: verifierAddress,
    sybilFee,
    ...requirements,
  }
}

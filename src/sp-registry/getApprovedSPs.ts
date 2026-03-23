import { decodeResult, encodeData } from 'ox/AbiFunction'
import { type FilecoinChain, filProvider } from '../utils/constants.ts'

const abi = [
  {
    inputs: [],
    name: 'getApprovedProvidersLength',
    outputs: [{ internalType: 'uint256', name: 'count', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'offset', type: 'uint256' },
      { internalType: 'uint256', name: 'limit', type: 'uint256' },
    ],
    name: 'getApprovedProviders',
    outputs: [
      { internalType: 'uint256[]', name: 'providerIds', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export const getApprovedSPs = async ({
  chain,
}: {
  chain: FilecoinChain
}): Promise<{
  providerIds: readonly bigint[]
  providerCount: bigint
}> => {
  const provider = filProvider[chain.id]
  // 1) Get total count
  const lenData = encodeData(abi[0])
  const lenResult = await provider.request({
    method: 'eth_call',
    params: [
      {
        data: lenData,
        to: chain.contracts.storageView.address,
      },
      'latest',
    ],
  })
  const providerCount = decodeResult(abi[0], lenResult)

  // 2) Fetch providerIds (offset=0, limit=count)
  const listData = encodeData(abi[1], [0n, providerCount])
  const listResult = await provider.request({
    method: 'eth_call',
    params: [
      {
        data: listData,
        to: chain.contracts.storageView.address,
      },
      'latest',
    ],
  })

  const providerIds = decodeResult(abi[1], listResult)

  return { providerIds, providerCount }
}

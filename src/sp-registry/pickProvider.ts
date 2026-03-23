import { randomInt } from 'node:crypto'
import type { Address } from 'ox/Address'
import { getClientDataSets } from '../data-set/getClientDatasets'

import type { FilecoinChain } from '../utils/constants'
import { getApprovedSPs } from './getApprovedSPs'
import { getProviderIdByAddress } from './getProviderIdByAddress'

type PickProviderParameters = {
  chain: FilecoinChain
} & (
  | {
      providerAddress: Address
      address?: never
    }
  | {
      address: Address
      providerAddress?: never
    }
  | {
      address?: never
      providerAddress?: never
    }
)

export const pickProvider = async (params: PickProviderParameters) => {
  let providerId: bigint
  if (params.providerAddress !== undefined) {
    providerId = await getProviderIdByAddress(params)
  } else if (params.address !== undefined) {
    const dataSets = (await getClientDataSets(params)).toSorted((a, b) => {
      // then newest client dataset
      if (a.clientDataSetId !== b.clientDataSetId)
        return Number(b.clientDataSetId - a.clientDataSetId)
      // deterministic tie-break
      return Number(b.providerId - a.providerId)
    })

    const activeDataSets = dataSets.filter((ds) => ds.pdpEndEpoch === 0n)

    if (activeDataSets.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: if there is more than one data set it must be defined
      const lastProvider = activeDataSets.at(-1)!
      providerId = lastProvider.providerId
    } else {
      const { providerIds, providerCount } = await getApprovedSPs({
        chain: params.chain,
      })
      // biome-ignore lint/style/noNonNullAssertion: providerCount equals providerIds.length
      providerId = providerIds[randomInt(Number(providerCount))]!
    }
  } else {
    const { providerIds, providerCount } = await getApprovedSPs({
      chain: params.chain,
    })
    // biome-ignore lint/style/noNonNullAssertion: providerCount equals providerIds.length
    providerId = providerIds[randomInt(Number(providerCount))]!
  }

  return providerId
}

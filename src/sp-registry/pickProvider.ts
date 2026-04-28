import { randomInt } from 'node:crypto'
import { type Address } from 'ox/Address'
import { getClientDataSets } from '../data-set/getClientDatasets.ts'

import { type FilecoinChain } from '../utils/constants.ts'
import { getApprovedSPs } from './getApprovedSPs.ts'
import { getProviderIdByAddress } from './getProviderIdByAddress.ts'

type PickProviderParameters =
  & {
    chain: FilecoinChain
  }
  & (
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

export const pickProvider = async (
  params: PickProviderParameters,
): Promise<bigint> => {
  const { providerIds, providerCount } = await getApprovedSPs({
    chain: params.chain,
  })

  let providerId = providerIds[randomInt(Number(providerCount))]!

  if (params.providerAddress !== undefined) {
    providerId = await getProviderIdByAddress(params)
  } else if (params.address !== undefined) {
    const activeDataSets = (await getClientDataSets(params)).filter((ds) =>
      ds.pdpEndEpoch === 0n && providerIds.includes(ds.providerId)
    ).toSorted((a, b) => {
      // then newest client dataset
      if (a.clientDataSetId !== b.clientDataSetId) {
        return Number(b.clientDataSetId - a.clientDataSetId)
      }
      // deterministic tie-break
      return Number(b.providerId - a.providerId)
    })

    if (activeDataSets.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: if there is more than one data set it must be defined
      const lastProvider = activeDataSets.at(-1)!
      providerId = lastProvider.providerId
    }
  }

  return providerId
}

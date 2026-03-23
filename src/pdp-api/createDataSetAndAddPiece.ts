import type { Hex } from 'ox/Hex'
import type { FilecoinChain } from '../utils/constants'

export const createDataSetAndAddPiece = async ({
  pieceCid,
  subPieceCids,
  chain,
  providerURL,
  payload: extraData,
}: {
  pieceCid: string
  subPieceCids: string[]
  chain: FilecoinChain
  providerURL: string
  payload: Hex
}): Promise<{ hash: Hex; statusUrl: URL }> => {
  const pieces = [
    {
      pieceCid,
      subPieces: subPieceCids.map((c) => ({ subPieceCid: c })),
    },
  ]

  const recordKeeper = chain.contracts.storage.address

  const res = await fetch(
    new URL('/pdp/data-sets/create-and-add', providerURL),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow',
      body: JSON.stringify({
        recordKeeper,
        pieces,
        extraData,
      }),
    },
  )

  if (!res.ok) throw res

  const location = res.headers.get('Location')
  if (!location) throw new Error('Location header not found')
  const hash = location?.split('/').pop() as Hex

  const statusUrl = new URL(location, providerURL)

  return { hash, statusUrl }
}

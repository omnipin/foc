import type { Hex } from 'ox/Hex'
import type { PieceLink } from '../utils/calculatePieceCID'

export const uploadPieceToDataSet = async ({
  pieceCid,
  providerURL,
  extraData,
  datasetId,
}: {
  datasetId: number
  pieceCid: PieceLink
  extraData?: Hex
  providerURL: string
}) => {
  const res = await fetch(
    new URL(`/pdp/data-sets/${datasetId}/pieces`, providerURL),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pieces: [pieceCid].map((piece) => ({
          pieceCid: piece.toString(),
          subPieces: [{ subPieceCid: piece.toString() }],
        })),
        extraData,
      }),
    },
  )

  if (res.ok) {
    const location = res.headers.get('Location')
    const hash = location?.split('/').pop()
    if (!location || !hash || !hash.startsWith('0x')) {
      throw new Error('Failed to locate transaction hash')
    }

    return {
      hash: hash as Hex,
      statusUrl: new URL(location, providerURL).toString(),
    }
  } else {
    const errorText = await res.text()
    if (errorText.includes('not found')) throw new Error('Data set not found')
    throw new Error(errorText)
  }
}

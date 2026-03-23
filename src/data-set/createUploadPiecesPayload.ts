import { toHex } from 'multiformats/bytes'
import * as AbiParameters from 'ox/AbiParameters'
import type { Hex } from 'ox/Hex'
import { sign } from 'ox/Secp256k1'
import * as Signature from 'ox/Signature'
import { getSignPayload } from 'ox/TypedData'
import type { PieceLink } from '../utils/calculatePieceCID.ts'
import type { FilecoinChain } from '../utils/constants.ts'
import { getDataSet } from './getDataSet.ts'

const metadata = [{ key: 'withIPFSIndexing', value: '' }] as const
const abi = [
  { type: 'uint256' },
  { type: 'string[][]' },
  { type: 'string[][]' },
  { type: 'bytes' },
] as const

export const uploadPieceToDataSet = async ({
  pieceCid,
  datasetId,
  privateKey,
  nonce,
  clientDataSetId,
  chain,
}: {
  pieceCid: PieceLink
  datasetId: bigint
  privateKey: Hex
  nonce: bigint
  clientDataSetId?: bigint
  chain: FilecoinChain
}): Promise<Hex> => {
  const pieces = [pieceCid]
  const pieceData = [{ data: `0x${toHex(pieceCid.bytes)}` }] as const

  if (!clientDataSetId) {
    const dataSet = await getDataSet({ dataSetId: datasetId, chain })
    clientDataSetId = dataSet.clientDataSetId
  }

  const payload = getSignPayload({
    types: {
      AddPieces: [
        { name: 'clientDataSetId', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'pieceData', type: 'Cid[]' },
        { name: 'pieceMetadata', type: 'PieceMetadata[]' },
      ],
      Cid: [{ name: 'data', type: 'bytes' }],
      PieceMetadata: [
        { name: 'pieceIndex', type: 'uint256' },
        { name: 'metadata', type: 'MetadataEntry[]' },
      ],
      MetadataEntry: [
        { name: 'key', type: 'string' },
        { name: 'value', type: 'string' },
      ],
    },
    domain: {
      name: 'FilecoinWarmStorageService',
      verifyingContract: chain.contracts.storage.address,
      version: '1',
      chainId: chain.id,
    },
    primaryType: 'AddPieces',
    message: {
      clientDataSetId,
      nonce,
      pieceData,
      pieceMetadata: pieces.map((_, index) => ({
        pieceIndex: BigInt(index),
        metadata,
      })),
    },
  })

  const signature = Signature.toHex(sign({ payload, privateKey }))

  const keys = [metadata.map((m) => m.key)]
  const values = [metadata.map((m) => m.value)]

  return AbiParameters.encode(AbiParameters.from(abi), [
    nonce,
    keys,
    values,
    signature,
  ])
}

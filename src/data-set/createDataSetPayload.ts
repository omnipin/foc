import { randomInt } from 'node:crypto'
import { AbiParameters } from 'ox'
import type { Address } from 'ox/Address'
import type { Hex } from 'ox/Hex'
import { sign } from 'ox/Secp256k1'
import { toHex } from 'ox/Signature'
import { getSignPayload } from 'ox/TypedData'
import type { FilecoinChain } from '../utils/constants.ts'

const abi = ['address', 'uint256', 'string[]', 'string[]', 'bytes'] as const

const metadata = [{ key: 'withIPFSIndexing', value: '' }] as const

const keys = metadata.map((item) => item.key)
const values = metadata.map((item) => item.value)

export const createDataSetPayload = ({
  chain,
  payee,
  payer,
  privateKey,
  clientDataSetId = BigInt(randomInt(10 ** 8)),
}: {
  chain: FilecoinChain
  payee: Address
  payer: Address
  privateKey: Hex
  clientDataSetId?: bigint
}): Hex => {
  const recordKeeper = chain.contracts.storage.address

  const payload = getSignPayload({
    types: {
      MetadataEntry: [
        { name: 'key', type: 'string' },
        { name: 'value', type: 'string' },
      ],
      CreateDataSet: [
        { name: 'clientDataSetId', type: 'uint256' },
        { name: 'payee', type: 'address' },
        { name: 'metadata', type: 'MetadataEntry[]' },
      ],
    },
    domain: {
      name: 'FilecoinWarmStorageService',
      verifyingContract: recordKeeper,
      version: '1',
      chainId: chain.id,
    },
    primaryType: 'CreateDataSet',
    message: {
      clientDataSetId,
      metadata,
      payee,
    },
  })

  const signature = toHex(sign({ payload, privateKey }))

  return AbiParameters.encode(AbiParameters.from(abi), [
    payer,
    clientDataSetId,
    keys,
    values,
    signature,
  ])
}

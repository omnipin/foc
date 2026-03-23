import { describe, expect, it } from 'bun:test'
import { randomInt } from 'node:crypto'
import { CarWriter } from '@ipld/car/writer'
import { CID } from 'multiformats/cid'
import * as raw from 'multiformats/codecs/raw'
import { sha256 } from 'multiformats/hashes/sha2'
import { calculatePieceCID } from '../utils/calculatePieceCID'
import { uploadPiece } from './uploadPiece'

// random payload to test uploads
const payload = new TextEncoder().encode(
  `hello world to Filecoin ${randomInt(1000).toString()}`,
)
const hash = await sha256.digest(raw.encode(payload))
const root = CID.create(1, raw.code, hash)

const { writer, out } = CarWriter.create([root])

const chunks: Uint8Array[] = []
const reader = (async () => {
  for await (const chunk of out) chunks.push(chunk)
})()

await writer.put({ cid: root, bytes: payload })
await writer.close()
await reader

const total = chunks.reduce((n, c) => n + c.length, 0)
const bytes = new Uint8Array(total)
let offset = 0
for (const c of chunks) {
  bytes.set(c, offset)
  offset += c.length
}

describe('uploadPiece', () => {
  it('should throw on a dead SP', async () => {
    expect(
      uploadPiece({
        providerURL: 'https://pdp-calib.filweb3.com',
        pieceCid: calculatePieceCID(bytes).toString(),
        bytes,
      }),
    ).rejects.toThrow('Bad Gateway')
  })
  it('should upload on an approved SP', async () => {
    const uuid = await uploadPiece({
      providerURL: 'https://main.ezpdpz.net',
      pieceCid: calculatePieceCID(bytes).toString(),
      bytes,
    })
    expect(uuid).toBeTypeOf('string')
    expect(uuid).toMatch(/([a-fA-F0-9-]+)/)
  })
})

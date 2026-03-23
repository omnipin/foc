import { sha256 } from '@noble/hashes/sha2'
import * as Raw from 'multiformats/codecs/raw'
import { create as createDigest } from 'multiformats/hashes/digest'
import * as Link from 'multiformats/link'
import varint from 'varint'

export type PieceLink = ReturnType<typeof Link.create>

const IN_BITS_FR = 254
const OUT_BITS_FR = 256
const FR_RATIO = IN_BITS_FR / OUT_BITS_FR // 127/128
const IN_BYTES_PER_QUAD = 127
const OUT_BYTES_PER_QUAD = 128
const MIN_PAYLOAD_SIZE = 127

// fr32-sha2-256-trunc254-padded-binary-tree
const PIECE_MULTIHASH_CODE = 0x1011

function toZeroPaddedSize(payloadSize: number): number {
  const size = Math.max(payloadSize, MIN_PAYLOAD_SIZE)
  const highestBit = Math.floor(Math.log2(size))
  const bound = Math.ceil(FR_RATIO * 2 ** (highestBit + 1))
  return size <= bound ? bound : Math.ceil(FR_RATIO * 2 ** (highestBit + 2))
}

function toPieceSize(unpaddedSize: number): number {
  return Math.floor(toZeroPaddedSize(unpaddedSize) / FR_RATIO)
}

function fr32Pad(source: Uint8Array): Uint8Array {
  const output = new Uint8Array(toPieceSize(source.length))
  const size = toZeroPaddedSize(source.length)
  const quadCount = size / IN_BYTES_PER_QUAD

  for (let n = 0; n < quadCount; n++) {
    const readOffset = n * IN_BYTES_PER_QUAD
    const writeOffset = n * OUT_BYTES_PER_QUAD

    output.set(source.subarray(readOffset, readOffset + 32), writeOffset)

    const b31 = output[writeOffset + 31]
    if (b31 === undefined) throw new Error('fr32 write out of bounds')
    output[writeOffset + 31] = b31 & 0b0011_1111

    for (let i = 32; i < 64; i++) {
      const curr = source[readOffset + i] ?? 0
      const prev = source[readOffset + i - 1] ?? 0
      const outIndex = writeOffset + i
      if (output[outIndex] === undefined)
        throw new Error('fr32 write out of bounds')
      output[outIndex] = ((curr << 2) | (prev >> 6)) & 0xff
    }

    const b63 = output[writeOffset + 63]
    if (b63 === undefined) throw new Error('fr32 write out of bounds')
    output[writeOffset + 63] = b63 & 0b0011_1111

    for (let i = 64; i < 96; i++) {
      const curr = source[readOffset + i] ?? 0
      const prev = source[readOffset + i - 1] ?? 0
      const outIndex = writeOffset + i
      if (output[outIndex] === undefined)
        throw new Error('fr32 write out of bounds')
      output[outIndex] = ((curr << 4) | (prev >> 4)) & 0xff
    }

    const b95 = output[writeOffset + 95]
    if (b95 === undefined) throw new Error('fr32 write out of bounds')
    output[writeOffset + 95] = b95 & 0b0011_1111

    for (let i = 96; i < 127; i++) {
      const curr = source[readOffset + i] ?? 0
      const prev = source[readOffset + i - 1] ?? 0
      const outIndex = writeOffset + i
      if (output[outIndex] === undefined)
        throw new Error('fr32 write out of bounds')
      output[outIndex] = ((curr << 6) | (prev >> 2)) & 0xff
    }

    const last = source[readOffset + 126] ?? 0
    if (output[writeOffset + 127] === undefined)
      throw new Error('fr32 write out of bounds')
    output[writeOffset + 127] = (last >> 2) & 0xff
  }

  return output
}

function trunc254InPlace(node: Uint8Array): void {
  const last = node[31]
  if (last === undefined) throw new Error('invalid node size')
  node[31] = last & 0b0011_1111
}

function hashNode(left: Uint8Array, right: Uint8Array): Uint8Array {
  const input = new Uint8Array(64)
  input.set(left, 0)
  input.set(right, 32)
  const out = new Uint8Array(sha256(input))
  trunc254InPlace(out)
  return out
}

function buildPieceRoot(fr32: Uint8Array): Uint8Array {
  if (fr32.length === 0 || fr32.length % 32 !== 0) {
    throw new Error(`invalid fr32 payload size: ${fr32.length}`)
  }

  const leavesCount = fr32.length / 32
  const targetLeaves = 1 << Math.ceil(Math.log2(leavesCount))
  let level: Uint8Array[] = new Array(targetLeaves)

  for (let i = 0; i < targetLeaves; i++) {
    const leaf = new Uint8Array(32)
    const start = i * 32
    if (start < fr32.length) leaf.set(fr32.subarray(start, start + 32))
    trunc254InPlace(leaf)
    level[i] = leaf
  }

  while (level.length > 1) {
    const next: Uint8Array[] = new Array(level.length / 2)
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]
      const right = level[i + 1]
      if (!left || !right) throw new Error('invalid tree state')
      next[i / 2] = hashNode(left, right)
    }
    level = next
  }

  const root = level[0]
  if (!root) throw new Error('failed to build piece root')
  return root
}

function pieceMultihashDigest(data: Uint8Array): Uint8Array {
  const fr32 = fr32Pad(data)
  const root = buildPieceRoot(fr32)

  const pieceSize = fr32.length
  const height = Math.log2(pieceSize / 32) // pieceSize is power-of-two bytes in Filecoin piece space

  if (!Number.isInteger(height) || height < 0 || height > 255) {
    throw new Error(`invalid piece height for piece size ${pieceSize}`)
  }

  // data-segment digest format:
  // [varint(padding)][1-byte height][32-byte root]
  // padding is the amount of unpadded bytes added to reach zero-padded size.
  const payloadPadding = toZeroPaddedSize(data.length) - data.length
  const paddingVarint = Uint8Array.from(varint.encode(payloadPadding))
  const out = new Uint8Array(paddingVarint.length + 1 + 32)
  out.set(paddingVarint, 0)
  out[paddingVarint.length] = height
  out.set(root, paddingVarint.length + 1)
  return out
}

export function calculatePieceCID(data: Uint8Array): PieceLink {
  const digestBytes = pieceMultihashDigest(data)
  const mh = createDigest(PIECE_MULTIHASH_CODE, digestBytes)
  return Link.create(Raw.code, mh)
}

import { describe, expect, it } from 'bun:test'
import { calculatePieceCID } from './calculatePieceCID'

describe('calculatePieceCID', () => {
  it('empty buf', () => {
    const piece = new Uint8Array()
    expect(calculatePieceCID(piece).toString()).toEqual(
      'bafkzcibcp4bdomn3tgwgrh3g532zopskstnbrd2n3sxfqbze7rxt7vqn7veigmy',
    )
  })
  it('127 bytes', () => {
    const piece = new Uint8Array(127)
    expect(calculatePieceCID(piece).toString()).toEqual(
      'bafkzcibcaabdomn3tgwgrh3g532zopskstnbrd2n3sxfqbze7rxt7vqn7veigmy',
    )
  })
  it('128 bytes', () => {
    const piece = new Uint8Array(128)
    expect(calculatePieceCID(piece).toString()).toEqual(
      'bafkzcibcpybwiktap34inmaex4wbs6cghlq5i2j2yd2bb2zndn5ep7ralzphkdy',
    )
  })
})

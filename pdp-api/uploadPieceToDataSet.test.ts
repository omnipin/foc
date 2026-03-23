import { describe, expect, it } from 'bun:test'
import { randomInt } from 'node:crypto'
import { calculatePieceCID } from '../utils/calculatePieceCID'
import { uploadPieceToDataSet } from './uploadPieceToDataSet'

describe('uploadPieceToDataSet', () => {
  it('should throw on a non-existent data set', async () => {
    try {
      await uploadPieceToDataSet({
        providerURL: 'https://main.ezpdpz.net',
        pieceCid: calculatePieceCID(new Uint8Array()),
        datasetId: randomInt(1000),
      })
    } catch (e) {
      expect((e as Error).message).toEqual('Data set not found')
    }
  })
})

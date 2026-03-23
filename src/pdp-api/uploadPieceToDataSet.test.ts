import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import { randomInt } from 'node:crypto'
import { calculatePieceCID } from '../utils/calculatePieceCID.ts'
import { uploadPieceToDataSet } from './uploadPieceToDataSet.ts'

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

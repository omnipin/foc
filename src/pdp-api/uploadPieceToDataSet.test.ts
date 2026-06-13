import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import { randomInt } from 'node:crypto'
import { calculatePieceCID } from '../utils/calculatePieceCID.ts'
import { uploadPieceToDataSet } from './uploadPieceToDataSet.ts'

describe('uploadPieceToDataSet', () => {
  it('should throw on a non-existent data set', async () => {
    await expect(
      uploadPieceToDataSet({
        providerURL: 'https://main.ezpdpz.net',
        pieceCid: calculatePieceCID(new Uint8Array(127)),
        datasetId: randomInt(1000),
      }),
    ).rejects.toThrow('Data set not found')
  })
})

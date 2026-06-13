import { type Hex } from 'ox/Hex'
import { type FilecoinChain } from '../utils/constants.ts'

/**
 * Ask a provider's Curio PDP API to create a new data set and add the first
 * piece in a single `create-and-add` request.
 *
 * The provider (Curio/SP) submits the on-chain `PDPVerifier.createDataSet`
 * transaction on the client's behalf, using the signed `payload`
 * (`extraData`) produced by {@link createDataSetPayload}.
 *
 * Cost responsibilities for new data sets (FWSS v1.3.0):
 * - **Client (payer):** must hold enough deposited USDFC and FWSS lockup
 *   allowance to cover the fixed lifecycle reserve (`0.10 USDFC`) plus the
 *   one-time dataset creation fee (`0.025 USDFC`) the contract locks on the
 *   PDP rail at creation, plus the streaming-rate lockup. Size this with
 *   `getUploadCosts` / {@link DEFAULT_NEW_DATASET_FIXED_FUNDS} before
 *   calling. (The v1.2.x `0.1 USDFC` sybil fee was removed in v1.3.0.)
 * - **Provider (Curio/SP):** must send the `0.1 FIL` cleanup deposit that
 *   PDPVerifier v3.4.0 requires on data-set creation. This is paid in native
 *   FIL by the SP submitting the transaction, not by the client, so it is
 *   handled entirely by the provider software.
 *
 * @see https://github.com/FilOzone/filecoin-services/releases/tag/v1.3.0
 */
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

  const text = await res.text()

  if (!res.ok) {
    throw new Error(`Failed to create data set and add piece: ${text}`)
  }

  const location = res.headers.get('Location')
  if (!location) throw new Error('Location header not found')
  const hash = location?.split('/').pop() as Hex

  const statusUrl = new URL(location, providerURL)

  return { hash, statusUrl }
}

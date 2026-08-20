export const verifyPiece = async ({
  providerURL,
  pieceCid,
}: {
  providerURL: string
  pieceCid: `bafk${string}`
}): Promise<boolean> => {
  // Curio's PDP API has no `GET /pdp/piece/{pieceCid}` route — piece lookup
  // is the find-piece endpoint, keyed by a query parameter (both on the
  // pdpv0 branch and on main).
  const res = await fetch(
    new URL(`/pdp/piece?pieceCid=${pieceCid}`, providerURL),
  )

  return res.ok
}

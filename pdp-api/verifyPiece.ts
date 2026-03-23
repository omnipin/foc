export const verifyPiece = async ({
  providerURL,
  pieceCid,
}: {
  providerURL: string
  pieceCid: `bafk${string}`
}): Promise<boolean> => {
  const res = await fetch(new URL(`/pdp/piece/${pieceCid}`, providerURL))

  return res.ok
}

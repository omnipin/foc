export const uploadPiece = async ({
  providerURL,
  pieceCid,
  bytes,
}: {
  providerURL: string
  pieceCid: string
  bytes: Uint8Array
}): Promise<string | Response> => {
  let res = await fetch(new URL('/pdp/piece', providerURL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pieceCid,
    }),
  })

  if (res.status === 201) {
    const location = res.headers.get('Location')

    if (!location) {
      throw new Error('Location header not found')
    }

    const uploadUuid = location.match(/\/piece\/upload\/([a-fA-F0-9-]+)/)?.[1]

    if (!uploadUuid) {
      throw new Error('Upload UUID not found in location header')
    }

    res = await fetch(new URL(`/pdp/piece/upload/${uploadUuid}`, providerURL), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': bytes.length.toString(),
      },
      body: bytes,
    })

    return uploadUuid
  }
  if (!res.ok) throw res.statusText
  return res
}

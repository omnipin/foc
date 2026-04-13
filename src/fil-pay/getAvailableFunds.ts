import { type Address } from 'ox/Address'
import { type FilecoinChain, filProvider } from '../utils/constants.ts'
import { getAccountInfo } from './getAccountInfo.ts'

export const getAvailableFunds = async ({
  address,
  chain,
}: {
  address: Address
  chain: FilecoinChain
}) => {
  const [
    funds,
    lockupCurrent,
    lockupRate,
    lockupLastSettledAt,
  ] = await getAccountInfo({ address, chain })

  const currentEpochHex = await filProvider[chain.id].request({
    method: 'eth_blockNumber',
  })
  const currentEpoch = BigInt(currentEpochHex)
  const epochsSinceSettlement = currentEpoch > lockupLastSettledAt
    ? currentEpoch - lockupLastSettledAt
    : 0n
  const settledLockupCurrent = lockupCurrent + epochsSinceSettlement * lockupRate
  const availableFunds = funds > settledLockupCurrent
    ? funds - settledLockupCurrent
    : 0n

  return {
    funds,
    lockupCurrent,
    lockupRate,
    lockupLastSettledAt,
    currentEpoch,
    epochsSinceSettlement,
    settledLockupCurrent,
    availableFunds,
  }
}

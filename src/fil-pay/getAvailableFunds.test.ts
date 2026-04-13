import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import { filecoinMainnet } from '../utils/constants.ts'
import { getAvailableFunds } from './getAvailableFunds.ts'

describe('getAvailableFunds', () => {
  it('should compute a settled available funds view for a live account', async () => {
    const account = await getAvailableFunds({
      address: '0x32c90c26bca6ed3945de9b29ba4e19d38314d618',
      chain: filecoinMainnet,
    })

    expect(account.currentEpoch > 0n).toBe(true)
    expect(account.funds >= 0n).toBe(true)
    expect(account.lockupCurrent >= 0n).toBe(true)
    expect(account.lockupRate >= 0n).toBe(true)
    expect(account.settledLockupCurrent >= account.lockupCurrent).toBe(true)
    expect(account.availableFunds >= 0n).toBe(true)
    expect(account.availableFunds <= account.funds).toBe(true)
  })
})

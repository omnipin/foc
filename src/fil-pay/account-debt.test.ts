import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import { calculateAccountDebt } from './account-debt.ts'

describe('calculateAccountDebt', () => {
  it('returns 0n for healthy accounts', () => {
    const debt = calculateAccountDebt({
      funds: 1_000n,
      lockupCurrent: 100n,
      lockupRate: 1n,
      lockupLastSettledAt: 0n,
      currentEpoch: 100n,
    })
    // owed = 100 + 1*100 = 200; funds = 1000 → debt = 0
    expect(debt).toBe(0n)
  })

  it('returns positive debt when totalOwed exceeds funds', () => {
    const debt = calculateAccountDebt({
      funds: 100n,
      lockupCurrent: 50n,
      lockupRate: 1n,
      lockupLastSettledAt: 0n,
      currentEpoch: 100n,
    })
    // owed = 50 + 1*100 = 150; funds = 100 → debt = 50
    expect(debt).toBe(50n)
  })

  it('handles zero lockupRate', () => {
    const debt = calculateAccountDebt({
      funds: 50n,
      lockupCurrent: 100n,
      lockupRate: 0n,
      lockupLastSettledAt: 0n,
      currentEpoch: 100n,
    })
    expect(debt).toBe(50n)
  })
})

import { describe, it } from '@std/testing/bdd'
import { expect } from '@std/expect'
import { resolveAccountState } from './resolve-account-state.ts'

describe('resolveAccountState', () => {
  it('returns full funds and maxUint fundedUntilEpoch when lockupRate is 0', () => {
    const out = resolveAccountState({
      funds: 1_000_000_000_000_000_000n,
      lockupCurrent: 0n,
      lockupRate: 0n,
      lockupLastSettledAt: 100n,
      currentEpoch: 200n,
    })
    expect(out.availableFunds).toBe(1_000_000_000_000_000_000n)
    expect(out.fundedUntilEpoch > 2n ** 250n).toBe(true)
  })

  it('rolls lockupCurrent forward by lockupRate * elapsed', () => {
    // lockupCurrent + rate*Δ = 100 + 1*10 = 110; available = 200 - 110 = 90
    const out = resolveAccountState({
      funds: 200n,
      lockupCurrent: 100n,
      lockupRate: 1n,
      lockupLastSettledAt: 0n,
      currentEpoch: 10n,
    })
    expect(out.availableFunds).toBe(90n)
  })

  it('clamps elapsed at fundedUntilEpoch when account is bankrupt', () => {
    // funds = 100, lockupCurrent = 50, rate = 1
    // fundedUntilEpoch = 0 + (100-50)/1 = 50
    // currentEpoch = 1000, but elapsed clamped to 50
    // simulatedLockupCurrent = 50 + 1*50 = 100; available = 100 - 100 = 0
    const out = resolveAccountState({
      funds: 100n,
      lockupCurrent: 50n,
      lockupRate: 1n,
      lockupLastSettledAt: 0n,
      currentEpoch: 1000n,
    })
    expect(out.availableFunds).toBe(0n)
    expect(out.fundedUntilEpoch).toBe(50n)
  })

  it('does not return negative availableFunds', () => {
    const out = resolveAccountState({
      funds: 50n,
      lockupCurrent: 100n,
      lockupRate: 0n,
      lockupLastSettledAt: 0n,
      currentEpoch: 0n,
    })
    expect(out.availableFunds).toBe(0n)
  })

  it('reproduces the on-chain numbers from the failing run', () => {
    // funds=0.442484722222041432, lockupCurrent=0.282490277777596984,
    // rate=2_777_777_777_776, lockupLastSettledAt=5_956_974,
    // currentEpoch=5_960_485
    const out = resolveAccountState({
      funds: 442_484_722_222_041_432n,
      lockupCurrent: 282_490_277_777_596_984n,
      lockupRate: 2_777_777_777_776n,
      lockupLastSettledAt: 5_956_974n,
      currentEpoch: 5_960_485n,
    })
    // available ≈ 0.150242 USDFC
    expect(out.availableFunds < 160_000_000_000_000_000n).toBe(true) // < 0.16
    expect(out.availableFunds > 149_000_000_000_000_000n).toBe(true) // > 0.149
  })
})

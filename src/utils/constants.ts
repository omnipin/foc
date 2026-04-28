import { type Address } from 'ox/Address'
import * as Provider from 'ox/Provider'
import { fromHttp } from 'ox/RpcTransport'

export type FilecoinChainId = 314 | 314159

export type FilecoinChain = {
  id: FilecoinChainId
  name: string
  contracts: {
    multicall3: {
      address: Address
    }
    usdfc: {
      address: Address
    }
    payments: {
      address: Address
    }
    storage: {
      address: Address
    }
    pdpVerifier: {
      address: Address
    }
    providerRegistry: {
      address: Address
    }
    storageView: {
      address: Address
    }
  }
  blockExplorer: string
}

export const filecoinMainnet = {
  id: 314,
  name: 'Filecoin Mainnet',
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    },
    usdfc: {
      address: '0x80B98d3aa09ffff255c3ba4A241111Ff1262F045',
    },
    payments: {
      address: '0x23b1e018F08BB982348b15a86ee926eEBf7F4DAa',
    },
    storage: {
      address: '0x8408502033C418E1bbC97cE9ac48E5528F371A9f',
    },
    pdpVerifier: {
      address: '0xBADd0B92C1c71d02E7d520f64c0876538fa2557F',
    },
    providerRegistry: {
      address: '0xf55dDbf63F1b55c3F1D4FA7e339a68AB7b64A5eB',
    },
    storageView: {
      address: '0xB1B3A3d979c1f233c1021EF98dff9c0932FF1bb9',
    },
  },
  blockExplorer: 'https://filecoin.blockscout.com',
} as const satisfies FilecoinChain

export const filecoinCalibration = {
  id: 314159,
  name: 'Filecoin Calibration Testnet',
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    },
    usdfc: {
      address: '0xb3042734b608a1B16e9e86B374A3f3e389B4cDf0',
    },
    payments: {
      address: '0x09a0fDc2723fAd1A7b8e3e00eE5DF73841df55a0',
    },
    storage: {
      address: '0x02925630df557F957f70E112bA06e50965417CA0',
    },
    pdpVerifier: {
      address: '0x85e366Cf9DD2c0aE37E963d9556F5f4718d6417C',
    },
    providerRegistry: {
      address: '0x839e5c9988e4e9977d40708d0094103c0839Ac9D',
    },
    storageView: {
      address: '0x537320bd004a7FDd3c1932ca64BD88268301322A',
    },
  },
  blockExplorer: 'https://filecoin-testnet.blockscout.com',
} as const satisfies FilecoinChain

export const filecoinChains = {}

export const filProvider: Record<FilecoinChainId, Provider.Provider> = {
  [filecoinMainnet.id]: Provider.from(
    fromHttp('https://api.node.glif.io/rpc/v1'),
  ),
  [filecoinCalibration.id]: Provider.from(
    fromHttp('https://api.calibration.node.glif.io/rpc/v1'),
  ),
}

export const chains = {
  [filecoinMainnet.id]: filecoinMainnet,
  [filecoinCalibration.id]: filecoinCalibration,
}

/**
 * Time and size constants for Filecoin FEVM.
 *
 * Mirrors `@filoz/synapse-core/utils/constants.TIME_CONSTANTS`.
 */
export const TIME_CONSTANTS = {
  /** Duration of each epoch in seconds on Filecoin (30s per tipset). */
  EPOCH_DURATION: 30,
  /** Number of epochs in a day (24 * 60 * 2). */
  EPOCHS_PER_DAY: 2880n,
  /** Number of epochs in a month (30 days). */
  EPOCHS_PER_MONTH: 86400n,
  /** Number of days in a month (used for pricing calculations). */
  DAYS_PER_MONTH: 30n,
  /** Default lockup period in days. */
  DEFAULT_LOCKUP_DAYS: 30n,
  /** Default expiry time for EIP-2612 permit signatures (seconds). */
  PERMIT_DEADLINE_DURATION: 3600,
} as const

/**
 * Data size constants.
 *
 * Mirrors `@filoz/synapse-core/utils/constants.SIZE_CONSTANTS`.
 */
export const SIZE_CONSTANTS = {
  KiB: 1024n,
  MiB: 1n << 20n,
  GiB: 1n << 30n,
  TiB: 1n << 40n,
  PiB: 1n << 50n,
} as const

/**
 * Default lockup period in epochs (30 days * 2880 epochs/day = 86,400 epochs).
 */
export const LOCKUP_PERIOD = TIME_CONSTANTS.DEFAULT_LOCKUP_DAYS *
  TIME_CONSTANTS.EPOCHS_PER_DAY

/**
 * Default safety margin (in epochs) when sizing deposits.
 *
 * Accounts for epoch drift between balance check and on-chain execution.
 * 5 epochs * 30s = ~2.5 minutes of headroom. Mirrors synapse-core.
 */
export const DEFAULT_BUFFER_EPOCHS = 5n

/**
 * Default extra runway in epochs beyond the required lockup. 0n = no extra.
 */
export const DEFAULT_RUNWAY_EPOCHS = 0n

/**
 * USDFC sybil fee charged on new dataset creation.
 *
 * Extracted from client funds into the payments auction pool to prevent
 * state-growth spam. Matches `PDPVerifier.USDFC_SYBIL_FEE` (immutable; only
 * changes with contract upgrade).
 */
export const USDFC_SYBIL_FEE = 100_000_000_000_000_000n // 0.1 USDFC

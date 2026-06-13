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
      // Redeployed in the FWSS v1.3.0 upgrade (the previous view
      // 0xB1B3A3d979c1f233c1021EF98dff9c0932FF1bb9 is bound to incompatible
      // storage and now reverts). Confirmed live via proxy.viewContractAddress().
      address: '0xAD28BBF18A72f728Ed816D07F5a1d7Ec40D68b5e',
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
      // Redeployed in the FWSS v1.3.0 upgrade (the previous view
      // 0x537320bd004a7FDd3c1932ca64BD88268301322A is bound to incompatible
      // storage and now reverts). Confirmed live via proxy.viewContractAddress().
      address: '0xF4B446171b3677fD2B9b183a9fB76d517365700a',
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
 * Default FWSS price list for the USDFC token, as of FWSS v1.3.0.
 *
 * Mirrors the constants in
 * `service_contracts/src/lib/PriceListUSDFC.sol` at the `v1.3.0` tag. These
 * are the values baked into the deployed implementation; the canonical
 * runtime source is `FilecoinWarmStorageServiceStateView.getPriceList()`
 * (see {@link getPriceList}). This constant is exported for tests, defaults,
 * and offline tooling that cannot read live state.
 *
 * USDFC has 18 decimals, so `1 USDFC = 10n ** 18n`. All amounts are in the
 * token's smallest unit. Streaming rates are per-month; per-epoch values are
 * derived by dividing by {@link TIME_CONSTANTS.EPOCHS_PER_MONTH} (86,400).
 *
 * @note The legacy minimum monthly storage-rate floor and the `0.1 USDFC`
 * sybil fee were both removed in v1.3.0. Pricing is now a size-proportional
 * storage rate plus a flat `datasetFeePerMonth`, and new-dataset funding is
 * sized around the lifecycle reserve + per-operation fees instead.
 *
 * @see https://github.com/FilOzone/filecoin-services/releases/tag/v1.3.0
 */
export const DEFAULT_USDFC_PRICE_LIST = {
  rates: {
    /** Size-proportional storage rate, per TiB per month. 2.5 USDFC. */
    storagePerTibPerMonth: 2_500_000_000_000_000_000n,
    /** Flat per-dataset additive monthly fee. 0.024 USDFC. */
    datasetFeePerMonth: 24_000_000_000_000_000n,
    /** CDN egress price, per TiB. 7 USDFC. */
    cdnEgressPerTib: 7_000_000_000_000_000_000n,
    /** Cache-miss egress price, per TiB. 7 USDFC. */
    cacheMissEgressPerTib: 7_000_000_000_000_000_000n,
  },
  fees: {
    /** One-time fee charged on dataset creation. 0.025 USDFC. */
    createDataSetFee: 25_000_000_000_000_000n,
    /** Base fee per `addPieces` call. 0.0005 USDFC. */
    addPiecesBaseFee: 500_000_000_000_000n,
    /** Additional fee per piece added. 0.0003 USDFC. */
    addPiecesPerPieceFee: 300_000_000_000_000n,
    /** Fee per `schedulePieceRemovals` call. 0.002 USDFC. */
    schedulePieceRemovalsFee: 2_000_000_000_000_000n,
    /** Consent-based (signed payer) termination fee. 0.00112 USDFC. */
    terminateFee: 1_120_000_000_000_000n,
  },
  lockups: {
    /** Fixed lifecycle reserve locked on the PDP rail. 0.10 USDFC. */
    lifecycleReserveTarget: 100_000_000_000_000_000n,
    /** Reserve balance that triggers a top-up. 0.005 USDFC. */
    replenishThreshold: 5_000_000_000_000_000n,
    /** Default PDP lockup period in epochs (30 days). */
    defaultLockupPeriod: 86_400n,
    /** CDN rail fixed lockup. 0.7 USDFC. */
    cdnLockupAmount: 700_000_000_000_000_000n,
    /** Cache-miss rail fixed lockup. 0.3 USDFC. */
    cacheMissLockupAmount: 300_000_000_000_000_000n,
    /** CDN/cache-miss settle window in epochs (5 days). */
    cdnLockupPeriod: 14_400n,
  },
} as const

/**
 * Flat per-dataset additive monthly fee, in USDFC's smallest unit (0.024
 * USDFC). Added on top of the size-proportional storage rate. Mirrors
 * `PriceListUSDFC.DATASET_FEE_PER_MONTH` at FWSS v1.3.0.
 */
export const DATASET_FEE_PER_MONTH =
  DEFAULT_USDFC_PRICE_LIST.rates.datasetFeePerMonth

/**
 * Per-dataset fee converted to a per-epoch rate, matching the contract's
 * `DATASET_FEE_PER_EPOCH = DATASET_FEE_PER_MONTH / EPOCHS_PER_MONTH`
 * (floored). This is the flat term added to every non-empty dataset's
 * per-epoch storage rate.
 */
export const DATASET_FEE_PER_EPOCH = DATASET_FEE_PER_MONTH /
  TIME_CONSTANTS.EPOCHS_PER_MONTH

/**
 * One-time fee charged out of the lifecycle reserve when a dataset is
 * created (0.025 USDFC). Mirrors `PriceListUSDFC.CREATE_DATA_SET_FEE`.
 */
export const CREATE_DATA_SET_FEE =
  DEFAULT_USDFC_PRICE_LIST.fees.createDataSetFee

/**
 * Fixed lifecycle reserve locked on the PDP rail at dataset creation (0.10
 * USDFC). Mirrors `PriceListUSDFC.LIFECYCLE_RESERVE_TARGET`. Replaces the
 * removed v1.2.x sybil fee as the up-front cost of creating a dataset.
 */
export const LIFECYCLE_RESERVE_TARGET =
  DEFAULT_USDFC_PRICE_LIST.lockups.lifecycleReserveTarget

/**
 * Default up-front USDFC a payer must have available for a new (non-CDN)
 * dataset at FWSS v1.3.0, beyond the streaming-rate lockup.
 *
 * At creation the contract locks the {@link LIFECYCLE_RESERVE_TARGET} (0.10
 * USDFC) on the PDP rail and records the {@link CREATE_DATA_SET_FEE} (0.025
 * USDFC) as a pending one-time payment drawn from that reserve. Sizing
 * deposits to cover `lifecycleReserveTarget + createDataSetFee` keeps the
 * creation flow funded.
 *
 * This replaces the removed v1.2.x `DEFAULT_MINIMUM_NEW_DATASET_LOCKUP`
 * (minimum-rate floor + sybil fee), which no longer exists on-chain.
 *
 * @see https://github.com/FilOzone/filecoin-services/releases/tag/v1.3.0
 */
export const DEFAULT_NEW_DATASET_FIXED_FUNDS = LIFECYCLE_RESERVE_TARGET +
  CREATE_DATA_SET_FEE

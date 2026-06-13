import { decodeResult, encodeData } from 'ox/AbiFunction'
import { type FilecoinChain, filProvider } from '../utils/constants.ts'

const abi = {
  type: 'function',
  inputs: [],
  name: 'getPriceList',
  outputs: [
    {
      name: 'list',
      internalType: 'struct PriceList',
      type: 'tuple',
      components: [
        { name: 'token', internalType: 'contract IERC20', type: 'address' },
        {
          name: 'rates',
          internalType: 'struct PriceListRates',
          type: 'tuple',
          components: [
            {
              name: 'storagePerTibPerMonth',
              internalType: 'uint256',
              type: 'uint256',
            },
            {
              name: 'datasetFeePerMonth',
              internalType: 'uint256',
              type: 'uint256',
            },
            {
              name: 'cdnEgressPerTib',
              internalType: 'uint256',
              type: 'uint256',
            },
            {
              name: 'cacheMissEgressPerTib',
              internalType: 'uint256',
              type: 'uint256',
            },
          ],
        },
        {
          name: 'fees',
          internalType: 'struct PriceListFees',
          type: 'tuple',
          components: [
            {
              name: 'createDataSetFee',
              internalType: 'uint256',
              type: 'uint256',
            },
            {
              name: 'addPiecesBaseFee',
              internalType: 'uint256',
              type: 'uint256',
            },
            {
              name: 'addPiecesPerPieceFee',
              internalType: 'uint256',
              type: 'uint256',
            },
            {
              name: 'schedulePieceRemovalsFee',
              internalType: 'uint256',
              type: 'uint256',
            },
            { name: 'terminateFee', internalType: 'uint256', type: 'uint256' },
          ],
        },
        {
          name: 'lockups',
          internalType: 'struct PriceListLockups',
          type: 'tuple',
          components: [
            {
              name: 'lifecycleReserveTarget',
              internalType: 'uint256',
              type: 'uint256',
            },
            {
              name: 'replenishThreshold',
              internalType: 'uint256',
              type: 'uint256',
            },
            {
              name: 'defaultLockupPeriod',
              internalType: 'uint256',
              type: 'uint256',
            },
            {
              name: 'cdnLockupAmount',
              internalType: 'uint256',
              type: 'uint256',
            },
            {
              name: 'cacheMissLockupAmount',
              internalType: 'uint256',
              type: 'uint256',
            },
            {
              name: 'cdnLockupPeriod',
              internalType: 'uint256',
              type: 'uint256',
            },
          ],
        },
      ],
    },
  ],
  stateMutability: 'view',
} as const

/** Streaming rates from {@link PriceList}. All amounts in USDFC smallest unit. */
export type PriceListRates = {
  /** Size-proportional storage rate, per TiB per month. */
  storagePerTibPerMonth: bigint
  /** Flat per-dataset additive monthly fee. */
  datasetFeePerMonth: bigint
  /** CDN egress price, per TiB (usage-settled by FilBeam, not streamed). */
  cdnEgressPerTib: bigint
  /** Cache-miss egress price, per TiB (usage-settled by FilBeam). */
  cacheMissEgressPerTib: bigint
}

/** One-time operation fees from {@link PriceList}, paid from the reserve. */
export type PriceListFees = {
  /** Fee charged on dataset creation. */
  createDataSetFee: bigint
  /** Base fee for an `addPieces` call. */
  addPiecesBaseFee: bigint
  /** Per-piece fee; an n-piece batch costs `base + n * perPiece`. */
  addPiecesPerPieceFee: bigint
  /** Fee per `schedulePieceRemovals` call. */
  schedulePieceRemovalsFee: bigint
  /** Consent-based (signed payer) termination fee. */
  terminateFee: bigint
}

/** Fixed-lockup amounts and lockup periods from {@link PriceList}. */
export type PriceListLockups = {
  /** Fixed lifecycle reserve sitting on the PDP rail. */
  lifecycleReserveTarget: bigint
  /** Reserve balance below which a top-up is triggered. */
  replenishThreshold: bigint
  /** Default PDP lockup period, in epochs. */
  defaultLockupPeriod: bigint
  /** CDN rail fixed lockup. */
  cdnLockupAmount: bigint
  /** Cache-miss rail fixed lockup. */
  cacheMissLockupAmount: bigint
  /** CDN/cache-miss settle window, in epochs. */
  cdnLockupPeriod: bigint
}

/**
 * Comprehensive price catalogue for an FWSS deployment, returned by
 * `FilecoinWarmStorageServiceStateView.getPriceList()`.
 */
export type PriceList = {
  /** USDFC token address for this deployment. */
  token: `0x${string}`
  rates: PriceListRates
  fees: PriceListFees
  lockups: PriceListLockups
}

/**
 * Read the canonical on-chain price list from the FWSS state-view contract.
 *
 * This is the v1.3.0 replacement for the removed `calculateRatePerEpoch()`
 * helper and the deprecated `getServicePrice()` struct. Pricing is now
 * delivered by contract upgrade rather than owner calls, so the returned
 * values are stable between upgrades.
 *
 * @see https://github.com/FilOzone/filecoin-services/releases/tag/v1.3.0
 */
export const getPriceList = async ({
  chain,
}: {
  chain: FilecoinChain
}): Promise<PriceList> => {
  const provider = filProvider[chain.id]
  const result = await provider.request({
    method: 'eth_call',
    params: [
      {
        to: chain.contracts.storageView.address,
        data: encodeData(abi),
      },
      'latest',
    ],
  })

  const list = decodeResult(abi, result)
  return list as PriceList
}

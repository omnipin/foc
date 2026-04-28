import { type Address } from 'ox/Address'
import { calculateAccountDebt } from '../fil-pay/account-debt.ts'
import { accounts } from '../fil-pay/accounts.ts'
import { isFwssMaxApproved } from '../fil-pay/is-fwss-max-approved.ts'
import { resolveAccountState } from '../fil-pay/resolve-account-state.ts'
import {
  DEFAULT_BUFFER_EPOCHS,
  DEFAULT_RUNWAY_EPOCHS,
  type FilecoinChain,
  filProvider,
  LOCKUP_PERIOD,
} from '../utils/constants.ts'
import { calculateDepositNeeded } from './calculate-deposit-needed.ts'
import { calculateEffectiveRate } from './calculate-effective-rate.ts'
import { getServicePricing } from './get-service-pricing.ts'

export type GetUploadCostsOptions = {
  /** The payer address. */
  clientAddress: Address
  /** Size of new data to upload, in bytes. */
  dataSize: bigint
  /** Whether a new dataset will be created. Defaults to `true`. */
  isNewDataSet?: boolean
  /** Current total dataset size, in bytes. Defaults to `0n`. */
  currentDataSetSize?: bigint
  /** Extra runway epochs beyond the required lockup. */
  extraRunwayEpochs?: bigint
  /** Safety margin in epochs. Defaults to `DEFAULT_BUFFER_EPOCHS`. */
  bufferEpochs?: bigint
  /** Filecoin chain. */
  chain: FilecoinChain
}

export type GetUploadCostsOutput = {
  /** Effective rate for the dataset after this upload. */
  rate: {
    /** Rate per epoch — matches the on-chain PDP rail rate. */
    perEpoch: bigint
    /** Rate per month — full precision for display. */
    perMonth: bigint
  }
  /** Total USDFC the payer must deposit. `0n` if already sufficient. */
  depositNeeded: bigint
  /** Whether the payer must call the variant that sets max FWSS approval. */
  needsFwssMaxApproval: boolean
  /** True iff `depositNeeded === 0n && !needsFwssMaxApproval`. */
  ready: boolean
}

/**
 * One-call orchestrator: read account state, pricing, and approval; compute
 * effective rate, deposit needed (with buffer/runway/debt), and approval
 * state.
 *
 * Mirrors `@filoz/synapse-core/warm-storage/getUploadCosts` minus CDN.
 */
export const getUploadCosts = async (
  options: GetUploadCostsOptions,
): Promise<GetUploadCostsOutput> => {
  const isNewDataSet = options.isNewDataSet ?? true
  const currentDataSetSize = options.currentDataSetSize ?? 0n
  const extraRunwayEpochs = options.extraRunwayEpochs ?? DEFAULT_RUNWAY_EPOCHS
  const bufferEpochs = options.bufferEpochs ?? DEFAULT_BUFFER_EPOCHS
  const provider = filProvider[options.chain.id]

  const [accountInfo, pricing, approved, currentEpochHex] = await Promise.all([
    accounts({ address: options.clientAddress, chain: options.chain }),
    getServicePricing({ chain: options.chain }),
    isFwssMaxApproved({
      clientAddress: options.clientAddress,
      chain: options.chain,
    }),
    provider.request({ method: 'eth_blockNumber' }),
  ])

  const currentEpoch = BigInt(currentEpochHex)

  // Effective rate for the new total dataset size.
  const totalSize = currentDataSetSize + options.dataSize
  const rate = calculateEffectiveRate({
    sizeInBytes: totalSize,
    pricePerTiBPerMonth: pricing.pricePerTiBPerMonthNoCDN,
    minimumPricePerMonth: pricing.minimumPricePerMonth,
    epochsPerMonth: pricing.epochsPerMonth,
  })

  const accountParams = {
    funds: accountInfo.funds,
    lockupCurrent: accountInfo.lockupCurrent,
    lockupRate: accountInfo.lockupRate,
    lockupLastSettledAt: accountInfo.lockupLastSettledAt,
    currentEpoch,
  }

  const debt = calculateAccountDebt(accountParams)
  const { availableFunds, fundedUntilEpoch } = resolveAccountState(
    accountParams,
  )

  const depositNeeded = calculateDepositNeeded({
    dataSize: options.dataSize,
    currentDataSetSize,
    pricePerTiBPerMonth: pricing.pricePerTiBPerMonthNoCDN,
    minimumPricePerMonth: pricing.minimumPricePerMonth,
    epochsPerMonth: pricing.epochsPerMonth,
    lockupEpochs: LOCKUP_PERIOD,
    isNewDataSet,
    currentLockupRate: accountInfo.lockupRate,
    extraRunwayEpochs,
    debt,
    availableFunds,
    fundedUntilEpoch,
    currentEpoch,
    bufferEpochs,
  })

  const needsFwssMaxApproval = !approved

  return {
    rate: {
      perEpoch: rate.ratePerEpoch,
      perMonth: rate.ratePerMonth,
    },
    depositNeeded,
    needsFwssMaxApproval,
    ready: depositNeeded === 0n && !needsFwssMaxApproval,
  }
}

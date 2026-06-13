import { type Address } from 'ox/Address'
export type DataSet = {
  pdpRailId: bigint
  cacheMissRailId: bigint
  cdnRailId: bigint
  payer: Address
  payee: Address
  serviceProvider: Address
  commissionBps: bigint
  clientDataSetId: bigint
  pdpEndEpoch: bigint
  providerId: bigint
  pendingOneTimePayments: bigint
  lifecycleReserveBalance: bigint
  dataSetId: bigint
}

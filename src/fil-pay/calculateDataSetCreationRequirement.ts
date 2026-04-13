export const DEFAULT_LOCKUP_PERIOD = 30n * 2880n

export const calculateDataSetCreationRequirement = ({
  minimumPricePerMonth,
  sybilFee,
}: {
  minimumPricePerMonth: bigint
  sybilFee: bigint
}) => {
  const minimumLockupRequired = minimumPricePerMonth
  const creationRequirement = minimumLockupRequired + sybilFee

  return {
    defaultLockupPeriod: DEFAULT_LOCKUP_PERIOD,
    epochsPerMonth: DEFAULT_LOCKUP_PERIOD,
    minimumLockupRequired,
    creationRequirement,
  }
}

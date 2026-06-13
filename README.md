<div align="center">

<h1>@omnipin/foc</h1>

[![JSR][jsr-img]][jsr] [![Test Workflow Status][gh-test-img]][gh-actions] [![Publish Workflow Status][gh-publish-img]][gh-actions]

<sub>TypeScript toolkit for the Filecoin Onchain Cloud</sub>

</div>

**@omnipin/foc** is a modular, tree-shakeable TypeScript library for interacting
with the [Filecoin Onchain Cloud](https://www.filecoin.io/cloud) — Filecoin
Warm Storage Service (FWSS), Filecoin Pay, the Service Provider Registry, and the
Curio PDP API. Built on [Ox](https://oxlib.sh), it ships zero heavyweight
dependencies and runs anywhere Ox does (Deno, Node, Bun, browsers).

## Features

- **PieceCID computation**. Pure-TS `fr32-sha2-256-trunc254-padded-binary-tree`
  hashing with a flat-buffer Merkle reduction that scales to multi-gigabyte
  payloads without exhausting memory.
- **Warm Storage pricing & cost orchestration**. Read the live FWSS price list,
  compute effective storage rates, deposits needed, lockups, and a one-call
  `getUploadCosts` orchestrator — fully up to date with FWSS **v1.3.0**
  (size-proportional storage rate + flat dataset fee, lifecycle reserve, and
  one-time creation fee).
- **Filecoin Pay integration**. Query account state and debt, resolve funding
  runway, check USDFC balances, and deposit with EIP-2612 permits — including
  the combined deposit-and-approve-operator flow.
- **Service Provider Registry**. Query approved SPs, resolve provider IDs,
  metadata, and payees, plus `pickProvider` for optimal/affinity-aware SP
  selection.
- **Data set management**. Build dataset and add-piece payloads, fetch a
  client's datasets, and read individual dataset state.
- **Curio PDP API client**. Create datasets, upload pieces, add pieces to
  existing datasets, and verify pieces against an SP.

## Install

```sh
# Deno
deno add jsr:@omnipin/foc

# npm
npx jsr add @omnipin/foc

# pnpm
pnpm dlx jsr add @omnipin/foc

# Yarn
yarn dlx jsr add @omnipin/foc

# Bun
bunx jsr add @omnipin/foc
```

## Usage

The library is split into focused entrypoints so bundlers only pull in what you
import:

| Import                  | What it covers                                       |
| ----------------------- | ---------------------------------------------------- |
| `@omnipin/foc/utils`    | PieceCID computation, chain constants & addresses    |
| `@omnipin/foc/warm-storage` | FWSS pricing, rates, deposits, upload cost orchestration |
| `@omnipin/foc/fil-pay`  | Filecoin Pay accounts, debt, balances, permit deposits |
| `@omnipin/foc/sp-registry` | Service Provider Registry queries & `pickProvider` |
| `@omnipin/foc/data-set` | Dataset/add-piece payloads & dataset reads           |
| `@omnipin/foc/pdp-api`  | Curio PDP API client (upload, verify, create)        |

### Compute a PieceCID

```ts
import { calculatePieceCID } from '@omnipin/foc/utils'

const cid = calculatePieceCID(new Uint8Array(await file.arrayBuffer()))
console.log(cid.toString())
```

### Estimate upload costs

```ts
import { getUploadCosts } from '@omnipin/foc/warm-storage'
import { filecoinCalibration } from '@omnipin/foc/utils'

const costs = await getUploadCosts({
  clientAddress: '0x…',
  dataSize: 100n * 1024n * 1024n, // 100 MiB
  isNewDataSet: true,
  chain: filecoinCalibration,
})

console.log(costs.rate.perEpoch, costs.depositNeeded, costs.ready)
```

### Pick a storage provider

```ts
import { pickProvider } from '@omnipin/foc/sp-registry'
import { filecoinCalibration } from '@omnipin/foc/utils'

// Affinity to the client's most recent active dataset, else random approved SP.
const providerId = await pickProvider({
  address: '0x…',
  chain: filecoinCalibration,
})
```

[jsr]: https://jsr.io/@omnipin/foc
[jsr-img]: https://img.shields.io/jsr/v/@omnipin/foc?style=for-the-badge&logo=jsr&color=%232B4AD4&label=
[gh-actions]: https://github.com/omnipin/foc/actions
[gh-test-img]: https://img.shields.io/github/actions/workflow/status/omnipin/foc/test.yml?branch=main&style=for-the-badge&logo=github&label=test&color=%232B4AD4
[gh-publish-img]: https://img.shields.io/github/actions/workflow/status/omnipin/foc/publish.yml?branch=main&style=for-the-badge&logo=github&label=publish&color=%232B4AD4

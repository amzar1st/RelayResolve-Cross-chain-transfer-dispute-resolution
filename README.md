# RelayResolve

RelayResolve resolves Across transfer disputes on the Ethereum-to-Base route. It checks whether a deposit was delivered, refunded, or remains unresolved, then lets GenLayer validators interpret versioned incident or recovery evidence alongside the receipt decision.

- [Public dashboard](https://relayresolve.tinymule33.chatgpt.site/)
- [Current StudioNet contract](https://explorer-studio.genlayer.com/address/0xBdb03Bdb95C1A33a0348a513Cd6A6b1e2C138B69)
- [Live verification and transactions](docs/LIVE_VERIFICATION.md)
- [Project Explorer submission text](docs/SUBMISSION.md)
- [Evidence and trust model](docs/SECURITY.md)

## Workflow

1. Enter an Ethereum source transaction and its Across deposit ID. The ID selects a single deposit event even when a transaction contains several deposits.
2. Open a case and review it. Each GenLayer validator independently retrieves the source receipt, protocol index and candidate settlement receipt. Exact agreement on normalized chain facts produces a decision digest.
3. Finalize a proven delivery or refund with that digest. Unresolved cases remain eligible for another evidence review. A finalized settlement decision is immutable.
4. Select a commit-pinned incident or recovery document, its SHA-256, and the interface status being disputed. Validators verify the document hash, independently interpret it, and audit the exact citation. The resulting report review is immutable and tied to the settlement decision snapshot.
5. Inspect the receipts, source publication, citation, provenance and consensus result in the dashboard.

## Live examples

The default example finalized a real **295.322271 USDT Ethereum refund**. The delivery example finalized **4.951764 USDC on Base**. The recovery report demo compares a simulated earlier failed-delivery label with the real refund. It records **STATUS_SUPERSEDED / DEMO_REPLAY**. A separate commit-pinned Across publication records **CONSISTENT / POLICY_ONLY** for the verified refund status.

The replay's earlier failed interface label is synthetic. The current Across index reports this deposit as refunded. The project has no archived screenshot showing that Across itself displayed failed for this deposit. Submitted interface labels are explicitly recorded as caller assertions.

## Run and verify

```sh
npm ci
npm test
npm run build
node scripts/verify-live.mjs
genvm-lint check contracts/relay_resolve.py
```

The frontend builds to `dist/`. Deployment settings are in `web/deployment.js`, and pinned example documents are in `web/reports.js`. The live verification script checks deployed source bytes, successful consensus and execution, two finalized settlement cases, two report interpretations, citations, and a rejected report review that left no state.

## Studio account workflow

Deployment and all recorded demo writes use GenLayer Studio's built-in account with **Normal (Full Consensus)** selected. Upload `contracts/relay_resolve.py`, deploy without constructor arguments, and call `open_case`, `review`, and `finalize`. Call `reconcile_report` with the document reference after a chain review, and read its returned identifier through `get_report`.

The dashboard reads without a signer. Its optional browser signer is a disposable StudioNet test account held only in page memory. Paste any Studio transaction hash into the tracker to follow the same write through pending, successful, failed or consensus-rejected states.

## Scope

The receipt profile supports current Across Ethereum-to-Base deposits, full origin refunds, and plain ERC-20 destination deliveries. Unsupported legacy events, embedded destination actions, speed-ups, missing index associations and ambiguous evidence may remain unresolved. Validators use live HTTP data, and the contract relies on the protocol index for deposit-to-refund association. It never transfers bridge funds.

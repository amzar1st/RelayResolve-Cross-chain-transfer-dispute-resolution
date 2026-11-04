# RelayResolve

RelayResolve reconciles Across transfers from Ethereum to Base. It records whether a specific deposit was delivered, refunded, or remains unresolved when a bridge label alone is insufficient. The contract never initiates, holds, or moves bridge funds.

- [Public dashboard](https://relayresolve.tinymule33.chatgpt.site/)
- [StudioNet contract](https://explorer-studio.genlayer.com/address/0x497B0005C4E84d5D43E7c8EAC728b36eEFAD80c4)
- [Live verification](docs/LIVE_VERIFICATION.md)
- [Evidence and trust model](docs/SECURITY.md)

## Workflow

1. Enter the Ethereum deposit transaction and the Across deposit ID. The ID selects a single deposit when the source transaction contains multiple events.
2. Open a case and request review. In the non-deterministic block, validators independently query the source receipt, Across index, and candidate settlement receipt. They reach exact agreement on a normalized decision containing amounts, addresses, transaction and block references, and log indices.
3. An unresolved case can be reviewed again. A verified case can be finalized by supplying the current decision digest. A finalized decision is immutable.
4. Read the finalized record from the public dashboard or call `get_case(source_tx, deposit_id)`.

The public dashboard opens the live refund case automatically. Browser write controls use an optional disposable memory-only StudioNet signer. For deployment and the recorded demo writes, use [GenLayer Studio](https://studio.genlayer.com/run-debug) and its built-in account, with **Normal (Full Consensus)** selected. Upload `contracts/relay_resolve.py`, deploy with no constructor arguments, and call `open_case`, `review`, and `finalize`. No extension is needed.

## Build and verify

```sh
npm ci
npm test
npm run build
node scripts/verify-live.mjs
```

The frontend builds to `dist/`. Set the target address in `web/deployment.js` before rebuilding for a different deployment. The verification script checks exact deployed source bytes, transaction execution and finality, and the persisted refund case.

## Supported evidence

The initial route supports the current Across SpokePool event formats for Ethereum to Base. Refunds require an indexed deposit-to-refund association, a matching full refund leaf, and a matching ERC-20 transfer to the depositor. Delivery requires an exact fill event and an exact ERC-20 transfer to the original recipient for a plain transfer. Unavailable, contradictory, partial, legacy or unsupported evidence can remain unresolved.

# RelayResolve milestone v1

This update adds portable evidence export and independent verification to the existing dashboard. The comparison baseline is repository commit `601503a`, which already supported on-chain settlement and cited report review. The StudioNet contract at `0xBdb03Bdb95C1A33a0348a513Cd6A6b1e2C138B69` on chain 61999 serves all reads. The contract source and deployment configuration are identical to the baseline.

## Reviewer walkthrough

1. Open the [dashboard](https://relayresolve.tinymule33.chatgpt.site/) and select **Load refund example**. Wait for **FINALIZED / REFUNDED** and the **STATUS_SUPERSEDED** report.
2. Under **Portable case evidence**, select **Download evidence JSON**. Send that file to another reviewer or open a fresh browser session.
3. Choose the downloaded file and select **Verify evidence packet**. Expect **REFUNDED** and **STATUS_SUPERSEDED (DEMO_REPLAY)** for deposit 4876368.
4. Try the [delivery packet](../evidence/packets/delivery.json). Expect **DELIVERED** for deposit 4875863. The [refund packet](../evidence/packets/refund.json) also works directly.
5. Edit the refund packet's settlement amount or report quotation and try again. The verifier rejects the altered fingerprint.

The refund packet preserves the report's caller-asserted label, citation and scope. The failed interface status in this replay is synthetic. The deposit and refund are real. The delivery packet shows the case-only export.

## Reproduce from the repository

```sh
npm ci
npm test
npm run build
node scripts/verify-evidence.mjs evidence/packets/refund.json
node scripts/verify-evidence.mjs evidence/packets/delivery.json
```

The browser and CLI share the verifier. It checks the network, deployment, decision digest and optional report identifier and context digest, then compares the complete snapshots to finalized RPC reads. An unavailable RPC prevents verification. Uploaded JSON is parsed locally. Only the case key and optional report identifier are sent as RPC read arguments. The result checks a snapshot against the configured StudioNet RPC, with the existing [trust model](SECURITY.md) for settlement and document review.

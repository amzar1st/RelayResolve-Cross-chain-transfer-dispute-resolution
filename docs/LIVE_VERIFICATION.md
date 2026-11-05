# Live verification

Current contract **0xBdb03Bdb95C1A33a0348a513Cd6A6b1e2C138B69**, StudioNet chain **61999**. [Public dashboard](https://relayresolve.tinymule33.chatgpt.site/) and [contract explorer](https://explorer-studio.genlayer.com/address/0xBdb03Bdb95C1A33a0348a513Cd6A6b1e2C138B69).

All recorded current-deployment writes use GenLayer Studio's built-in account in **Normal (Full Consensus)** mode. The SDK verification script checks exact deployed source bytes, each transaction's leader execution and consensus result, signer consistency, settled cases and report citations. See the [machine-readable evidence](../evidence/live-verification.json) and [transaction manifest](../evidence/deployment.json).

| Operation | Successful finalized transaction |
| --- | --- |
| Deploy report-enabled contract | [0x63000031…3d3715](https://explorer-studio.genlayer.com/tx/0x63000031e071afacda8b99bd3c0947898aadbc11bb87e4544a1c3fdf9e3d3715) |
| Open refund case | [0x9d528ee2…ac2cd3](https://explorer-studio.genlayer.com/tx/0x9d528ee223ea1abcad6ea0fb2e0d9c84087515f28bd7ec33279c0186a2ac2cd3) |
| Review refund receipts | [0xc15c786d…3bdc0f](https://explorer-studio.genlayer.com/tx/0xc15c786db4476d8dcf7eed26acc198fd8b79579cdfa71cdea6f1e3762b3bdc0f) |
| Finalize refund | [0xd33ecb24…fbf2d8](https://explorer-studio.genlayer.com/tx/0xd33ecb2498057e198bacd7776c6de270a037ada4af5c664a18c5f5ca17fbf2d8) |
| Interpret recovery replay | [0xb8bfc0c7…757c8e](https://explorer-studio.genlayer.com/tx/0xb8bfc0c7ab503cb7410559bab2f2da56ea0954fb8afe443033d888f688757c8e) |
| Open delivery case | [0x4627773d…a95c32](https://explorer-studio.genlayer.com/tx/0x4627773d662a6880d3e03217699e642fb854ca4d10d78d01082242dcb7a95c32) |
| Review delivery receipts | [0x5549dad8…6243cd](https://explorer-studio.genlayer.com/tx/0x5549dad8d0a314567eaf091d8e658e0dfa4ff38b98a21b46a0cb01499a6243cd) |
| Finalize delivery | [0x5de89123…14bcf1](https://explorer-studio.genlayer.com/tx/0x5de8912346301bcaf8200cbbc92318e9e890f7e27de7fc39c81808862f14bcf1) |
| Interpret Across publication | [0xfb90ab49…21bd03](https://explorer-studio.genlayer.com/tx/0xfb90ab492ee77effdbf0de4ac28271d8b0785c144aedf6455b0849f06321bd03) |

## Refund and delivery

The default refund case is Across deposit **4876368**. Validators matched an Ethereum deposit to a finalized refund-root leaf and the full **295.322271 USDT** transfer back to depositor `0x4be66294c6bb5af0da8ad96f186dec0f712979e6`. The application finalized **REFUNDED** with decision digest `9f728f6ec583b40b5bbc963ccab3e0bbfd6ff25caccd7eef2c9ac85fead2dba0`.

- [Ethereum deposit](https://etherscan.io/tx/0x966b1f2e6a5deacaa36c62db30ad63a3c0d933b7f1b0fd57842145691b012d46)
- [Ethereum refund](https://etherscan.io/tx/0x1d26ffb38ce115feb91ed35c9d73d1bfb1ba36136fb059c1ba1d5d1d55fe6ff1)
- [Across index association](https://app.across.to/api/deposit/status?originChainId=1&depositId=4876368)

The delivery example is Across deposit **4875863**. Validators matched source deposit fields to the Base fill event and exact **4.951764 USDC** recipient transfer. The application finalized **DELIVERED** with digest `a9f5318549f7d9fae744726279924044a62d6d7f9c66cc0cee4aa56d5a4452fc`.

- [Ethereum deposit](https://etherscan.io/tx/0xf67d35206c20adcaae8934f0c3d91cb3533dc445ee3ac850aee4d527ecb5df04)
- [Base fill and transfer](https://basescan.org/tx/0xf5bd4a57f4515b8f256b7e0e032aa849ba62ad6b4896d468019d7e63ef84227a)

## Independent report interpretation

The default [recovery replay](https://github.com/amzar1st/RelayResolve-Cross-chain-transfer-dispute-resolution/blob/95fcae345fb9db81684e53809c8d55ed3347e6a4/evidence/replays/refund-recovery.md) is commit-pinned, hash-verified, and labelled synthetic. Its earlier failed interface observation is test data. Its deposit and refund references are real. Validators independently classified the cited recovery narrative as **STATUS_SUPERSEDED**, audited the quotation, and stored **DEMO_REPLAY / CALLER_ASSERTED** provenance under report ID `24aab731d6ecad47bce2644ea5a07688382779f6c6f94b4b83ed2b6fc2901609`.

A separate [Across protocol publication](https://github.com/across-protocol/skills/blob/2b0ffd11824e3c97682ddb491c4ad141c4e0f5d0/skills/tracking-transactions/SKILL.md) was interpreted against the verified current refunded status. Validators recorded **CONSISTENT / POLICY_ONLY** under report ID `7563053080e478db581111c2edc2beadf3eb6079a147414e472d5628cbd4d164`. The policy explains a status definition and does not authenticate a historical interface label.

There is no historical screenshot proving Across's interface displayed failed for this real deposit. The replay communicates that limitation in the source, stored provenance and dashboard.

## Rejected consensus and failure handling

Validators disagreed on interpreting the general publication against an alleged earlier expired label. [That transaction](https://explorer-studio.genlayer.com/tx/0x3c397c444b233c981346d6f591ca906f1e4b03f6a8943dfd563471f7a334e884) eventually has a finalized receipt but **MAJORITY_DISAGREE**. Its leader's successful execution is insufficient to establish a successful write. The report identifier remains absent from state. The tracker explicitly checks this case and displays a failed transaction.

The automated suite also checks wrong routes and pools, unrelated refund leaves, incorrect amounts, unfinalized receipts, conflicting references, immutable finalization, stale decision hashes, failed data retrieval, invalid report hosts/paths, digest mismatches, fabricated citations, malformed model output, attempted settlement promotion, and independent validator dissent.

## Reproduce

Run `npm ci`, `npm test`, `npm run build`, `genvm-lint check contracts/relay_resolve.py`, and `node scripts/verify-live.mjs`. The suite has **31 passing tests**. [GenVM validation](../evidence/genvm-validation.json) passes all lint and SDK checks for the pinned runner. The verification script performs reads only and requires live network access.

In the dashboard, load the refund or delivery example. Under incident and recovery evidence, load the recovery replay or Across policy and read its recorded interpretation. Paste the corresponding Studio transaction into the tracker to inspect finality and execution. Requesting a new report review requires a reviewed case, an approved commit-pinned document, its SHA-256 and a caller-reported status.

## Previous deployment

The first deployment remains at `0x497B0005C4E84d5D43E7c8EAC728b36eEFAD80c4`. Its source is preserved in repository commit `727f2c14e3a4198cdb6d5ecd508c2a5d9706929a`, and the older `studionet-refund.json` and `studionet-delivery.json` evidence files refer to that deployment. The report-enabled version uses the address above and the `live-verification.json` record.

## Published browser checks

The updated public release was opened in the browser and read both finalized cases and both report interpretations. Browser checks also covered signer creation, citation and provenance switching, successful transaction tracking, and a finalized majority-disagreement receipt shown as failed. The [published report-consensus screenshot](../evidence/RelayResolve-Report-Consensus.jpg) shows the recorded interpretation and quotation.

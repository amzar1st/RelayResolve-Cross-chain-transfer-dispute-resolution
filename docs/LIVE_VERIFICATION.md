# StudioNet verification

Network **61999**. Public dashboard [RelayResolve](https://relayresolve.tinymule33.chatgpt.site/). Contract [0x497B0005C4E84d5D43E7c8EAC728b36eEFAD80c4](https://explorer-studio.genlayer.com/address/0x497B0005C4E84d5D43E7c8EAC728b36eEFAD80c4).

The deployment and refund case were signed by Studio's built-in account `0x2Ca57A7DCe3243C4213B6443543bd86A3368e2d9` in Full Consensus mode. Contract source returned by the SDK matched `contracts/relay_resolve.py` byte for byte. SHA-256 `dbb572b327f0d30db2278ed77e962672d51a923b330c42a9e4ecfa921f49bca2`.

| Operation | Finalized receipt |
| --- | --- |
| Deploy | [0x4aff…134e](https://explorer-studio.genlayer.com/transactions/0x4affcbd1b91e5cd030d3e6baa1fac3cd27949f54e445e4c9ebde23588abb134e) |
| Open refund case | [0x69a2…0c0a](https://explorer-studio.genlayer.com/transactions/0x69a2e9644fc2677691536419ceb217b73d5aa5fcf6593614ef3b61cef0a50c0a) |
| Review refund | [0x14df…c2fe](https://explorer-studio.genlayer.com/transactions/0x14df04bb04dc7855f53061e57b01e6826fbbd7528a24c254ca7a32f7a2b6c2fe) |
| Finalize refund | [0x2cc9…e4bf](https://explorer-studio.genlayer.com/transactions/0x2cc919bae4fb33732c9ac378f1ec80b3b0451473adbc1cae73de1dedbf21e4bf) |
| Duplicate open rejected | [0x1735…0aec](https://explorer-studio.genlayer.com/transactions/0x1735082fa75354013c89c821b059f0873d52bbb656550bb9df347d1549f40aec) |

## Live refund case

Across deposit ID **4876368**. The Ethereum SpokePool emitted the source deposit and later transferred **295.322271 USDT** back to the depositor, in refund bundle **30730**. Validators matched the Across index association, refund leaf, token, recipient, and raw amount **295322271**. The persisted case reads **FINALIZED / REFUNDED** and has decision digest `9f728f6ec583b40b5bbc963ccab3e0bbfd6ff25caccd7eef2c9ac85fead2dba0`.

- [Source deposit](https://etherscan.io/tx/0x966b1f2e6a5deacaa36c62db30ad63a3c0d933b7f1b0fd57842145691b012d46)
- [Across index](https://app.across.to/api/deposit/status?originChainId=1&depositId=4876368)
- [Ethereum refund](https://etherscan.io/tx/0x1d26ffb38ce115feb91ed35c9d73d1bfb1ba36136fb059c1ba1d5d1d55fe6ff1)
- [Verified StudioNet record](../evidence/studionet-refund.json)

The current bridge index labels this real case refunded. A stale `expired` label with the same valid refund proof is tested using a modified index fixture. There is no historical screenshot proving the bridge interface labeled this case failed.

## Reproduce

Open the public dashboard and click **Load refund example**. It reads StudioNet finalized state and links to the source and settlement evidence. The public transaction tracker was also tested against both the successful finalize receipt and the failed duplicate-open receipt. Run `node scripts/verify-live.mjs` to verify the deployed source and successful finalized lifecycle independently. Run `npm test` for 18 checks and `npm run build` for the frontend bundle.

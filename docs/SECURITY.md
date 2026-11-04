# Evidence and trust model

## Decision boundary

The contract uses fixed HTTPS endpoints and pinned Ethereum and Base SpokePool addresses. User input is limited to an Ethereum transaction hash and a canonical uint256 deposit ID. JSON response sizes, receipt logs, ABI data, deposit message length, and refund arrays are bounded. Bridge labels are retained for comparison. Verified receipt fields determine the outcome.

A refund requires a successful, finalized origin receipt later than the source receipt, the Across index's exact deposit-to-refund association, an Across refund root leaf with the correct token, depositor and full amount, and one matching transfer from the Ethereum SpokePool. The receipt alone does not identify the deposit in an aggregated refund bundle. RelayResolve relies on Across for that association.

A delivery requires the exact origin chain and ID and matching original fill deadline, exclusivity fields, depositor, recipient, token and amount fields. Embedded actions, recipient changes, legacy events, wrapped-native payouts, and alternative settlement paths can remain unresolved. A missing settlement can mean missing or delayed index data. Conflicting fill and refund references remain unresolved.

## Consensus

GenLayer leaders and validators independently fetch the evidence and apply the same receipt checks. Strict equivalence compares canonical decision JSON instead of volatile block-head and API response fields. An agreement on that record gives the application its audit trail. It does not provide an Ethereum or Base light client or independently prove an Across root-bundle association. A public RPC, explorer proxy, or protocol index can be unavailable or wrong. Source disagreement can delay review, and lack of usable evidence keeps the case unresolved.

Incident prose and recovery reports are outside the current contract's evidence path. Reviewers can compare the cited bridge index and receipts. Natural-language incident interpretation is planned separately so it can never authorize settlement.

## Operational scope

Cases are permissionless and keyed by deposit hash and ID. No privileged action can override a finalized result. StudioNet is a development network and may reset. The public dashboard requires no signer to read and never requests an existing wallet seed. Its optional throwaway account is held in page memory and signs zero-value StudioNet calls only. Do not send funds to it.

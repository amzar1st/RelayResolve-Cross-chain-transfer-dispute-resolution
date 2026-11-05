# Evidence and trust model

## Receipt checks

The contract fixes the route, HTTPS providers, event signatures and Ethereum/Base SpokePool addresses. User-selected transaction hashes and decimal deposit IDs are bounded. Response size, receipt log counts, ABI words, deposit message size and refund arrays are bounded.

Refund verification requires a finalized successful origin receipt later than the source receipt, the Across index's exact deposit association, an Across refund-root leaf matching token/depositor/full amount, and a matching ERC-20 transfer from the origin SpokePool. Aggregated refund bundles do not independently identify the deposit. The protocol index supplies that association.

Delivery verification requires a matching current-format Across fill and ERC-20 recipient transfer. Origin chain, deposit ID, deadline, exclusivity fields, depositor, recipient, tokens and amounts must match the source. Embedded actions, recipient changes, legacy formats, partial payments and native-token paths can remain unresolved. Contradictory fill and refund references remain unresolved.

## Report references and provenance

Reports must use exact `raw.githubusercontent.com` URLs with a full lowercase commit SHA, a bounded Markdown path, and a supplied SHA-256 of the fetched bytes. Approved repository paths are `across-protocol/skills`, `across-protocol/user-docs`, and this project's `evidence/replays/` directory. Protocol publication attribution depends on GitHub's repository and commit hosting. A digest pins content and does not establish that every assertion in a document is true.

Project-authored sources always retain **DEMO_REPLAY** provenance. Protocol documents containing the source transaction identifier are labelled **CASE_SPECIFIC**. General documents retain **POLICY_ONLY** scope. Mentioning a transaction makes a document relevant to a case; it does not replace receipt verification. Every submitted interface label retains **CALLER_ASSERTED** provenance. A policy citation cannot authenticate an earlier screenshot.

## Semantic consensus

A first equivalence block independently fetches and verifies the bounded report. An invalid attachment records an inconclusive report result and leaves the settlement state intact. A second block uses independent LLM classifications and a custom validator. Validators require the same interpretation, an exact quotation present in the hashed document, valid outcome constraints, and a separate citation-support audit.

Document content is serialized as untrusted data. Prompts prohibit obeying embedded commands. The response schema accepts only an interpretation and citation. Malformed responses become inconclusive. A report cannot promote an unresolved receipt to a completed payment. Refund eligibility and refund promises remain distinct from a completed token transfer.

A report record binds the source transaction, deposit ID, settlement decision digest, document URL/hash, caller's label, provenance, interpretation and citation. Its context digest and immutable identifier prevent overwriting a prior review. If an unresolved settlement later changes, its new digest produces a different report identifier.

## Consensus and operations

Receipt consensus compares normalized stable facts, including block hashes and log indices, instead of volatile provider heads. It is an application-level HTTP evidence verifier rather than a chain light client. Provider errors, stale finalized heads, rate limits, missing index data or validator disagreement can prevent a result.

The tracker requires both successful leader execution and an agreeing consensus result before displaying success. A finalized receipt with majority disagreement is a failed write and may leave no application state. The live evidence includes this case.

Cases are permissionless and keyed by deposit transaction and ID. Verified settlements finalize with a matching decision digest. StudioNet is a development network and may reset. No privileged method overrides a finalized settlement. The contract does not custody or move funds. Browser test signers remain in memory and require no existing wallet seed.

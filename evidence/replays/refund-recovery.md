# Refund recovery replay

This is a synthetic interface replay for RelayResolve testing. The interface failure label below is a test observation, not a historical claim about the Across website. The deposit and refund transaction references identify real chain receipts.

## Earlier interface observation

Route: Across, Ethereum (1) to Base (8453).
Source transaction: 0x966b1f2e6a5deacaa36c62db30ad63a3c0d933b7f1b0fd57842145691b012d46
Deposit ID: 4876368.
Simulated interface status: failed.
The replay describes a deposit whose destination fill did not complete before its deadline. The failed label describes delivery failure, not a permanent loss of the origin funds.

## Recovery report

The source-chain refund was completed after the failed delivery observation. Ethereum refund transaction 0x1d26ffb38ce115feb91ed35c9d73d1bfb1ba36136fb059c1ba1d5d1d55fe6ff1 returns the full input amount of 295322271 USDT base units to depositor 0x4be66294c6bb5af0da8ad96f186dec0f712979e6 in Across refund bundle 30730. The completed refund supersedes the earlier failed delivery label for the purpose of deciding where these funds ended up.

This report does not assert destination delivery. A refund promise or eligibility alone would leave settlement unresolved. RelayResolve must independently validate the source deposit, protocol index association, refund leaf and token transfer before recording REFUNDED.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { publicClient, readCase, readReport, reportId, receiptState } from '../web/chain.js';
import { deployment } from '../web/deployment.js';
import { reportSources } from '../web/reports.js';

const manifest = JSON.parse(await readFile(new URL('../evidence/deployment.json', import.meta.url), 'utf8'));
const source = await readFile(new URL('../contracts/relay_resolve.py', import.meta.url), 'utf8');
assert.equal(deployment.address, manifest.address);
assert.equal(deployment.chainId, manifest.chainId);
assert.equal(await publicClient.getContractCode(deployment.address), source, 'Deployed source differs');
const transactions = await Promise.all(Object.entries(manifest.transactions).map(async ([method, hash]) => {
  const tx = await publicClient.getTransaction({ hash });
  assert.equal(receiptState(tx), 'success', method);
  assert.equal(tx.to_address.toLowerCase(), manifest.address.toLowerCase());
  assert.notEqual(tx.leader_only, true, 'Full consensus is required');
  return {
    method, hash, status: tx.status, result: tx.result_name ?? tx.result,
    signer: tx.from_address, leaderOnly: tx.leader_only,
    votes: tx.consensus_data?.votes,
    executions: tx.consensus_data?.leader_receipt?.map(receipt => ({
      mode: receipt.mode, vote: receipt.vote, execution: receipt.execution_result,
    })),
  };
}));
assert.ok(transactions.every(tx => tx.signer === transactions[0].signer), 'Demo signer changed');
const refund = await readCase(deployment.exampleHash, deployment.exampleId);
const delivery = await readCase(deployment.deliveryHash, deployment.deliveryId);
assert.equal(refund.stage, 'FINALIZED');
assert.equal(refund.decision.outcome, 'REFUNDED');
assert.equal(refund.decision.settlement.amount, '295322271');
assert.equal(refund.decision.settlement.tx, '0x1d26ffb38ce115feb91ed35c9d73d1bfb1ba36136fb059c1ba1d5d1d55fe6ff1');
assert.equal(delivery.stage, 'FINALIZED');
assert.equal(delivery.decision.outcome, 'DELIVERED');
assert.equal(delivery.decision.settlement.amount, '4951764');
assert.equal(delivery.decision.settlement.tx, '0xf5bd4a57f4515b8f256b7e0e032aa849ba62ad6b4896d468019d7e63ef84227a');
const reports = {};
for (const [kind, expected, scope] of [
  ['replay', 'STATUS_SUPERSEDED', 'DEMO_REPLAY'], ['policy', 'CONSISTENT', 'POLICY_ONLY'],
]) {
  const reference = reportSources[kind];
  const key = await reportId(deployment.exampleHash, deployment.exampleId, refund.decision_sha256,
    reference.url, reference.sha256, reference.label);
  const report = await readReport(key);
  assert.equal(report.interpretation, expected);
  assert.equal(report.scope, scope);
  assert.equal(report.evidence_status, 'VERIFIED');
  assert.equal(report.label_provenance, 'CALLER_ASSERTED');
  assert.equal(report.decision_sha256, refund.decision_sha256);
  assert.equal(report.source.sha256, reference.sha256);
  let text;
  if (kind === 'policy') {
    const response = await fetch(reference.url);
    assert.ok(response.ok, 'Pinned protocol publication is unavailable');
    text = await response.text();
  } else {
    text = await readFile(new URL('../evidence/replays/refund-recovery.md', import.meta.url), 'utf8');
  }
  assert.equal(createHash('sha256').update(text).digest('hex'), reference.sha256);
  assert.ok(report.quote.length >= 20 && text.includes(report.quote), 'Citation was not present in source');
  reports[kind] = report;
}
const rejected = await publicClient.getTransaction({ hash: manifest.rejectedInterpretation });
assert.equal(receiptState(rejected), 'failed');
assert.ok(['FINALIZED', 7, '7'].includes(rejected.status), 'Verify finalized disagreement handling');
const absentId = await reportId(deployment.exampleHash, deployment.exampleId, refund.decision_sha256,
  reportSources.policy.url, reportSources.policy.sha256, 'expired');
assert.equal(await readReport(absentId), null, 'Rejected interpretation changed state');
console.log(JSON.stringify({
  chainId: manifest.chainId, address: manifest.address,
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  transactions, cases: { refund, delivery }, reports,
  rejectedInterpretation: {
    hash: manifest.rejectedInterpretation, status: rejected.status, result: rejected.result_name ?? rejected.result,
    votes: rejected.consensus_data?.votes, reportAbsent: true,
  },
}, null, 2));

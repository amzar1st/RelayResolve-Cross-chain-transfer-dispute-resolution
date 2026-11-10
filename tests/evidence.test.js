import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { verifyEvidence } from '../web/evidence.js';

const load = name => JSON.parse(readFileSync(new URL(`../evidence/packets/${name}.json`, import.meta.url)));

for (const name of ['refund', 'delivery']) {
  test(`verifies the captured ${name} evidence and checks the lookup identifiers`, async () => {
    const packet = load(name);
    let reportReads = 0;
    const verified = await verifyEvidence(packet, {
      getCase: (hash, id) => {
        assert.equal(hash, packet.hash);
        assert.equal(id, packet.id);
        return packet.record;
      },
      getReport: id => {
        reportReads++;
        assert.equal(id, packet.report.report_id);
        return packet.report;
      },
    });
    assert.deepEqual(verified.record, packet.record);
    assert.equal(reportReads, name === 'refund' ? 1 : 0);
  });
}

test('rejects altered, nonfinal and cross-deployment packets before RPC', async () => {
  for (const [alter, message] of [
    [p => { p.chainId = 1; }, /network/],
    [p => { p.contract = '0x0000000000000000000000000000000000000000'; }, /contract/],
    [p => { p.record.stage = 'REVIEWED'; }, /finalized decision/],
    [p => { p.record.decision.settlement.amount = '10'; }, /fingerprint/],
    [p => { p.id = '9'.repeat(78); }, /deposit ID/],
    [p => { p.report.quote = 'Forged citation'; }, /fingerprint/],
    [p => { p.report.deposit_id = '7'; }, /different case/],
    [p => { p.report.report_id = '0'.repeat(64); }, /identifier/],
  ]) {
    const packet = load('refund');
    alter(packet);
    await assert.rejects(verifyEvidence(packet, {
      getCase: () => assert.fail('Invalid packet reached RPC'),
    }), message);
  }
});

test('rejects snapshots absent or different on finalized StudioNet and propagates RPC failures', async () => {
  const packet = load('refund');
  await assert.rejects(verifyEvidence(packet, { getCase: () => null }), /case snapshot differs/);
  await assert.rejects(verifyEvidence(packet, {
    getCase: () => ({ ...packet.record, revision: -1 }),
  }), /case snapshot differs/);
  await assert.rejects(verifyEvidence(packet, {
    getCase: () => packet.record, getReport: () => null,
  }), /report differs/);
  await assert.rejects(verifyEvidence(packet, {
    getCase: () => { throw Error('RPC unavailable'); },
  }), /RPC unavailable/);
});

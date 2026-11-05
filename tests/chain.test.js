import test from 'node:test';
import assert from 'node:assert/strict';
import { follow, receiptState, testSigner } from '../web/chain.js';

const tx = (status, execution_result) => ({
  status, result: 6, consensus_data: { leader_receipt: [{ mode: 'leader', execution_result }] },
});

test('accepted state remains pending', () => {
  assert.equal(receiptState(tx('ACCEPTED', 'SUCCESS')), 'pending');
});

test('finalized success requires a successful execution receipt', () => {
  assert.equal(receiptState(tx('FINALIZED', 'SUCCESS')), 'success');
  assert.equal(receiptState(tx('FINALIZED', 'ERROR')), 'failed');
  assert.equal(receiptState({ status: 'FINALIZED' }), 'failed');
  assert.equal(receiptState(tx('UNDETERMINED', 'SUCCESS')), 'failed');
});

test('poller retries transient failures without resubmitting', async () => {
  let reads = 0;
  const state = await follow('original', () => {}, {
    interval: 0,
    fetchTx: hash => {
      assert.equal(hash, 'original');
      if (++reads === 1) throw Error('temporary failure');
      return reads === 2 ? tx('ACCEPTED', 'SUCCESS') : tx('FINALIZED', 'SUCCESS');
    },
  });
  assert.equal(reads, 3);
  assert.equal(state, 'success');
});

test('poller separates a timeout from a failed execution', async () => {
  assert.equal(await follow('original', () => {}, {
    retries: 1, fetchTx: () => tx('ACCEPTED', 'SUCCESS'),
  }), 'unknown');
});

test('disposable signers use separate local addresses', () => {
  const first = testSigner();
  assert.match(first.address, /^0x[\da-f]{40}$/i);
  assert.notEqual(first.address, testSigner().address);
});

test('numeric undetermined transactions are terminal failures', () => {
  assert.equal(receiptState(tx(6, 'ERROR')), 'failed');
  assert.equal(receiptState(tx('6', 'ERROR')), 'failed');
});

test('report IDs bind the source, snapshot, document, digest and caller label', async () => {
  const { reportId } = await import('../web/chain.js');
  const args = ['0x' + '1'.repeat(64), '1', 'b'.repeat(64), 'https://example.test', 'a'.repeat(64), 'expired'];
  const expected = await reportId(...args);
  assert.equal(expected, 'e23af128e823ebd84dd42d78cce97eb33a8b97e73345f170c726299e1d777746');
  assert.notEqual(await reportId(...args.slice(0, -1), 'failed'), expected);
  assert.notEqual(await reportId(args[0], args[1], 'c'.repeat(64), ...args.slice(3)), expected);
});


test('a finalized leader execution rejected by consensus is a failed write', () => {
  const rejected = { ...tx('FINALIZED', 'SUCCESS'), result: 7, result_name: 'MAJORITY_DISAGREE' };
  assert.equal(receiptState(rejected), 'failed');
  assert.equal(receiptState({ ...tx('FINALIZED', 'SUCCESS'), result: 5 }), 'failed');
  assert.equal(receiptState({ ...tx('FINALIZED', 'SUCCESS'), result: undefined }), 'failed');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { follow, receiptState, testSigner } from '../web/chain.js';

const tx = (status, execution_result) => ({
  status, consensus_data: { leader_receipt: [{ mode: 'leader', execution_result }] },
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

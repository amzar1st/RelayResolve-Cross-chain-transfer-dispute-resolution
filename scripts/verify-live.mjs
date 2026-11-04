import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { publicClient, readCase, receiptState } from '../web/chain.js';
import { deployment } from '../web/deployment.js';

const hashes = {
  deploy: deployment.deploymentTx,
  open: '0x69a2e9644fc2677691536419ceb217b73d5aa5fcf6593614ef3b61cef0a50c0a',
  review: '0x14df04bb04dc7855f53061e57b01e6826fbbd7528a24c254ca7a32f7a2b6c2fe',
  finalize: '0x2cc919bae4fb33732c9ac378f1ec80b3b0451473adbc1cae73de1dedbf21e4bf',
};
const duplicateHash = '0x1735082fa75354013c89c821b059f0873d52bbb656550bb9df347d1549f40aec';
const source = await readFile(new URL('../contracts/relay_resolve.py', import.meta.url), 'utf8');
const [code, record, transactions, duplicate] = await Promise.all([
  publicClient.getContractCode(deployment.address),
  readCase(deployment.exampleHash, deployment.exampleId),
  Promise.all(Object.entries(hashes).map(async ([method, hash]) => {
    const tx = await publicClient.getTransaction({ hash });
    assert.equal(receiptState(tx), 'success', method);
    assert.equal(tx.to_address.toLowerCase(), deployment.address.toLowerCase());
    return {
      method, hash, status: tx.status, signer: tx.from_address,
      votes: tx.consensus_data?.votes ?? null,
    };
  })),
  publicClient.getTransaction({ hash: duplicateHash }),
]);
assert.equal(code, source, 'Deployed contract bytes differ from repository source');
assert.equal(receiptState(duplicate), 'failed');
assert.ok(['FINALIZED', 7, '7'].includes(duplicate.status));
assert.equal(record.stage, 'FINALIZED');
assert.equal(record.decision.outcome, 'REFUNDED');
assert.equal(record.decision.settlement.amount, '295322271');
assert.equal(record.decision.settlement.tx, '0x1d26ffb38ce115feb91ed35c9d73d1bfb1ba36136fb059c1ba1d5d1d55fe6ff1');
assert.equal(record.decision_sha256, '9f728f6ec583b40b5bbc963ccab3e0bbfd6ff25caccd7eef2c9ac85fead2dba0');
console.log(JSON.stringify({
  chainId: deployment.chainId, address: deployment.address,
  sourceSha256: createHash('sha256').update(source).digest('hex'), transactions,
  rejectedDuplicate: { hash: duplicateHash, status: duplicate.status, execution: receiptState(duplicate) },
  record,
}, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));

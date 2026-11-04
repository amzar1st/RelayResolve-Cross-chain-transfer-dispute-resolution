import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { deployment } from './deployment.js';

export const validHash = hash => /^0x[0-9a-f]{64}$/i.test(hash);
const client = account => createClient({ chain: studionet, endpoint: deployment.rpc, account });
export const publicClient = client();
export const readCase = async (hash, id) => {
  const data = await publicClient.readContract({
    address: deployment.address, functionName: 'get_case', args: [hash, id],
    transactionHashVariant: 'latest-final',
  });
  return data === '' ? null : JSON.parse(data);
};

export function testSigner() {
  const account = privateKeyToAccount(generatePrivateKey());
  return { address: account.address, client: client(account) };
}

export function receiptState(tx) {
  const status = tx?.status;
  if (['UNDETERMINED', 'CANCELED', 'CANCELLED', 'REVERTED', 8, '8'].includes(status)) return 'failed';
  if (!['FINALIZED', 7, '7'].includes(status)) return 'pending';
  const execution = tx.consensus_data?.leader_receipt;
  const leader = Array.isArray(execution) ? execution.find(row => row.mode === 'leader') || execution[0] : execution;
  return leader?.execution_result === 'SUCCESS' ? 'success' : 'failed';
}

export async function submit(signer, method, args) {
  const result = await signer.client.writeContract({
    address: deployment.address, functionName: method, args, value: 0n, leaderOnly: false,
  });
  const hash = typeof result === 'string' ? result : result?.hash || result?.txId;
  if (!validHash(hash || '')) throw new Error('No valid transaction hash was returned.');
  return hash;
}

export async function follow(hash, update, { retries = 90, interval = 3000, fetchTx = h => publicClient.getTransaction({ hash: h }) } = {}) {
  for (let attempt = 0; attempt < retries; attempt++) {
    let tx;
    try {
      tx = await fetchTx(hash);
    } catch {
      update('RPC temporarily unavailable. Tracking the original transaction.');
    }
    if (tx) {
      const state = receiptState(tx);
      if (state !== 'pending') return state;
      update(`Transaction ${tx.status ?? 'submitted'}. Waiting for finality.`);
    }
    if (attempt + 1 < retries) await new Promise(resolve => setTimeout(resolve, interval));
  }
  return 'unknown';
}

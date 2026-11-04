import { deployment } from './deployment.js';
import { follow, readCase, submit, testSigner, validHash } from './chain.js';

const byId = id => document.getElementById(id);
const hashField = byId('hash');
const idField = byId('id');
const lookupStatus = byId('lookup-status');
const txState = byId('tx-state');
const resume = byId('resume');
const names = { open: 'open_case', review: 'review', finalize: 'finalize' };
const reasons = {
  SOURCE_NOT_VERIFIED: 'A finalized deposit matching this route and deposit ID could not be verified.',
  DEPOSIT_EVENT_NOT_MATCHED: 'The source receipt did not contain a supported deposit event for this ID.',
  INDEX_NOT_VERIFIED: 'The bridge index was unavailable or could not be matched to the source deposit.',
  CONFLICTING_SETTLEMENT_REFERENCES: 'The bridge index returned both a fill and refund reference.',
  NO_VERIFIED_SETTLEMENT: 'No settlement receipt met the checks for this deposit. The case remains open for another review.',
  MATCHED_ACROSS_ORIGIN_REFUND: 'A finalized Ethereum receipt matched the Across refund bundle and full transfer to the depositor.',
  MATCHED_ACROSS_DESTINATION_FILL: 'A finalized Base receipt matched the Across fill and exact transfer to the recipient.',
};
let active;
let signer;
let pendingHash;
let busy = false;
let lookupVersion = 0;

byId('contract-link').href = `${deployment.explorer}/address/${deployment.address}`;
function buttons() {
  const enabled = Boolean(active && signer && !busy && !pendingHash);
  byId('open').disabled = !enabled || active.record !== null;
  byId('review').disabled = !enabled || !active.record || active.record.stage === 'FINALIZED'
    || Boolean(active.record.decision && active.record.decision.outcome !== 'UNRESOLVED');
  byId('finalize').disabled = !enabled || active.record?.stage !== 'REVIEWED'
    || !['REFUNDED', 'DELIVERED'].includes(active.record?.decision?.outcome);
  byId('connect').disabled = busy || Boolean(signer);
  resume.disabled = busy;
  byId('track-submit').disabled = busy;
}

function link(container, label, url) {
  const element = document.createElement('a');
  element.textContent = label;
  element.href = url;
  element.target = '_blank';
  element.rel = 'noopener noreferrer';
  container.append(element);
}

function render() {
  const record = active?.record;
  const decision = record?.decision;
  const badge = byId('badge');
  badge.textContent = record?.stage === 'FINALIZED' ? `FINALIZED / ${decision.outcome}`
    : decision ? `REVIEWED / ${decision.outcome}` : record?.stage ?? (active ? 'NO ON-CHAIN CASE' : 'NO CASE LOADED');
  badge.dataset.terminal = String(record?.stage === 'FINALIZED');
  byId('explanation').textContent = decision ? reasons[decision.reason] ?? decision.reason
    : record ? 'The case is open. Review it to check the source and settlement records.'
    : active ? 'There is no finalized case for this deposit yet.' : 'Look up a deposit to read finalized GenLayer state.';
  const facts = byId('facts');
  facts.replaceChildren();
  const deposit = decision?.deposit;
  const settlement = decision?.settlement;
  const fields = [
    ['Deposit ID', active?.id], ['Bridge index', decision?.bridge_status], ['Depositor', deposit?.depositor],
    ['Recipient', deposit?.recipient], ['Input (raw units)', deposit?.input_amount], ['Input token', deposit?.input_token],
    ['Output (raw units)', deposit?.output_amount], ['Output token', deposit?.output_token],
    ['Settlement (raw units)', settlement?.amount], ['Settlement recipient', settlement?.recipient],
    ['Refund bundle', settlement?.bundle], ['Review revision', record?.revision],
    ['Decision SHA-256', record?.decision_sha256],
  ];
  for (const [label, value] of fields) {
    if (value === undefined) continue;
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = label;
    detail.textContent = value;
    facts.append(term, detail);
  }
  const evidence = byId('evidence');
  evidence.replaceChildren();
  if (active) link(evidence, 'Ethereum deposit ↗', `https://etherscan.io/tx/${active.hash}`);
  if (deposit) link(evidence, 'Across index ↗', `https://app.across.to/api/deposit/status?originChainId=1&depositId=${active.id}`);
  if (settlement && validHash(settlement.tx)) {
    const host = decision.outcome === 'REFUNDED' ? 'etherscan.io' : 'basescan.org';
    link(evidence, decision.outcome === 'REFUNDED' ? 'Ethereum refund ↗' : 'Base fill ↗', `https://${host}/tx/${settlement.tx}`);
  }
  buttons();
}

async function lookup() {
  const version = ++lookupVersion;
  const hash = hashField.value.trim().toLowerCase();
  const id = idField.value.trim();
  active = undefined;
  render();
  if (!validHash(hash) || !/^(0|[1-9][0-9]{0,77})$/.test(id) || BigInt(id) >= 2n ** 256n) {
    lookupStatus.textContent = 'Enter a 32-byte Ethereum transaction hash and decimal Across deposit ID.';
    return;
  }
  lookupStatus.textContent = 'Reading finalized StudioNet state…';
  try {
    const record = await readCase(hash, id);
    if (lookupVersion !== version) return;
    active = { hash, id, record };
    lookupStatus.textContent = 'Finalized state loaded.';
    render();
  } catch {
    if (lookupVersion === version) lookupStatus.textContent = 'StudioNet read failed. Check your connection and try again.';
  }
}

function example() {
  hashField.value = deployment.exampleHash;
  idField.value = deployment.exampleId;
  return lookup();
}

async function track(hash) {
  pendingHash = hash;
  const txLink = byId('tx-link');
  txLink.href = `${deployment.explorer}/transactions/${hash}`;
  txLink.hidden = false;
  byId('track-hash').value = hash;
  resume.hidden = true;
  txState.textContent = 'Submitted. Waiting for GenLayer consensus and finality.';
  const result = await follow(hash, message => { txState.textContent = message; });
  if (result === 'unknown') {
    txState.textContent = 'Finality is still unconfirmed. Check this transaction again before submitting a replacement.';
    resume.hidden = false;
  } else {
    pendingHash = undefined;
    txState.textContent = result === 'success' ? 'Finalized with successful execution.' : 'Transaction failed. Inspect its receipt for the execution result.';
    await lookup();
  }
}

byId('lookup').addEventListener('submit', event => { event.preventDefault(); void lookup(); });
byId('example').addEventListener('click', () => { void example(); });
for (const field of [hashField, idField]) field.addEventListener('input', () => {
  ++lookupVersion;
  active = undefined;
  lookupStatus.textContent = '';
  render();
});
byId('connect').addEventListener('click', () => {
  try {
    signer = testSigner();
    byId('account').textContent = `Disposable StudioNet signer · ${signer.address}`;
    buttons();
  } catch {
    byId('account').textContent = 'Could not create a secure browser signer. Use Studio to submit.';
  }
});
for (const [id, method] of Object.entries(names)) byId(id).addEventListener('click', async () => {
  if (!active || !signer || busy || pendingHash) return;
  busy = true;
  buttons();
  const args = [active.hash, active.id];
  if (id === 'finalize') args.push(active.record.decision_sha256);
  txState.textContent = 'Signing a zero-value StudioNet transaction…';
  byId('tx-link').hidden = true;
  try {
    await track(await submit(signer, method, args));
  } catch (error) {
    txState.textContent = `Submission could not be confirmed. Check the case or signer activity before retrying. ${error.shortMessage ?? error.message}`;
  } finally {
    busy = false;
    buttons();
  }
});
byId('track-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const hash = byId('track-hash').value.trim().toLowerCase();
  if (!validHash(hash)) {
    txState.textContent = 'Enter a valid StudioNet transaction hash.';
    return;
  }
  busy = true;
  buttons();
  try {
    await track(hash);
  } finally {
    busy = false;
    buttons();
  }
});
resume.addEventListener('click', async () => {
  if (!pendingHash || busy) return;
  busy = true;
  buttons();
  try {
    await track(pendingHash);
  } finally {
    busy = false;
    buttons();
  }
});
void example();

import { deployment } from './deployment.js';
import { readCase, readReport, reportId, validHash } from './chain.js';

const format = 'relayresolve-evidence-v1';
export const evidenceLimit = 64 * 1024;

// Match Python's sorted JSON and ASCII escapes used for contract fingerprints.
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => canonical(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
}

async function fingerprint(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function evidencePacket({ hash, id, record }, report = null) {
  return { format, chainId: deployment.chainId, contract: deployment.address, hash, id, record, report };
}

export async function verifyEvidence(packet, { getCase = readCase, getReport = readReport } = {}) {
  const { format: version, chainId, contract, hash, id, record, report } = packet ?? {};
  if (version !== format || chainId !== deployment.chainId || typeof contract !== 'string'
    || contract.toLowerCase() !== deployment.address.toLowerCase()) {
    throw Error('Unsupported evidence format, network, or contract address.');
  }
  if (typeof hash !== 'string' || !validHash(hash) || hash !== hash.toLowerCase()
    || typeof id !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(id) || BigInt(id) >= 2n ** 256n) {
    throw Error('Invalid Ethereum transaction hash or Across deposit ID.');
  }
  if (record?.stage !== 'FINALIZED' || !['REFUNDED', 'DELIVERED'].includes(record.decision?.outcome)
    || await fingerprint(record.decision) !== record.decision_sha256) {
    throw Error('The packet has no valid finalized decision fingerprint.');
  }
  if (report !== null) {
    if (!report || report.source_tx !== hash || report.deposit_id !== id
      || report.decision_sha256 !== record.decision_sha256 || report.receipt_outcome !== record.decision.outcome
      || typeof report.source?.url !== 'string' || typeof report.source?.sha256 !== 'string'
      || typeof report.reported_label !== 'string') {
      throw Error('The report is bound to a different case or decision.');
    }
    const { context_sha256, ...context } = report;
    if (await reportId(hash, id, record.decision_sha256, report.source.url, report.source.sha256, report.reported_label) !== report.report_id
      || await fingerprint(context) !== context_sha256) {
      throw Error('The report identifier or context fingerprint does not match.');
    }
  }
  const finalized = await getCase(hash, id);
  if (!finalized || canonical(finalized) !== canonical(record)) {
    throw Error('The case snapshot differs from finalized StudioNet state.');
  }
  if (report !== null) {
    const recorded = await getReport(report.report_id);
    if (!recorded || canonical(recorded) !== canonical(report)) {
      throw Error('The report differs from finalized StudioNet state.');
    }
  }
  return { hash, id, record: finalized, report };
}

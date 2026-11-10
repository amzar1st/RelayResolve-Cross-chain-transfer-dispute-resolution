import { open } from 'node:fs/promises';
import { evidenceLimit, verifyEvidence } from '../web/evidence.js';

try {
  if (process.argv.length !== 3) throw Error('Usage: node scripts/verify-evidence.mjs <packet.json>');
  const file = await open(process.argv[2]);
  let packet;
  try {
    const buffer = Buffer.alloc(evidenceLimit + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (bytesRead > evidenceLimit) throw Error('Evidence packet exceeds 64 KiB.');
    packet = JSON.parse(buffer.toString('utf8', 0, bytesRead));
  } finally {
    await file.close();
  }
  const { id, record, report } = await verifyEvidence(packet);
  const interpretation = report ? ` and report ${report.interpretation} (${report.scope})` : '';
  console.log(`Verified deposit ${id}: ${record.decision.outcome}${interpretation}. Packet matches finalized StudioNet state.`);
} catch (error) {
  console.error(`Verification failed. ${error.shortMessage ?? error.message}`);
  process.exitCode = 1;
}

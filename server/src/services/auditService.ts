import { db } from '../database/schema.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Writes an immutable, hash-chained audit log entry.
 *
 * Each entry stores:
 *  - prev_hash: SHA-256 of the previous audit log entry (GENESIS_HASH for first entry)
 *  - entry_hash: SHA-256(prev_hash + id + action + entity_type + entity_id + details + created_at)
 *
 * This forms a tamper-evident chain: deleting or modifying any row breaks the chain,
 * which can be detected by the /api/admin/audit-integrity endpoint.
 */

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000'; // 64-char sentinel

export function logAudit(params: {
  branchId?: string | string[] | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | string[] | null;
  details?: Record<string, any> | string;
}) {
  try {
    const branchIdStr = Array.isArray(params.branchId) ? params.branchId[0] : (params.branchId || null);
    const entityIdStr = Array.isArray(params.entityId) ? params.entityId[0] : (params.entityId || null);
    const detailsStr = typeof params.details === 'object' ? JSON.stringify(params.details) : params.details || '';
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    // Get the last entry's hash to chain from
    const lastEntry = db.prepare(
      'SELECT entry_hash FROM audit_logs WHERE entry_hash IS NOT NULL ORDER BY rowid DESC LIMIT 1'
    ).get() as { entry_hash: string } | undefined;
    const prevHash = lastEntry?.entry_hash || GENESIS_HASH;

    // Compute this entry's hash
    const payload = `${prevHash}|${id}|${params.action}|${params.entityType}|${entityIdStr || ''}|${detailsStr}|${createdAt}`;
    const entryHash = crypto.createHash('sha256').update(payload).digest('hex');

    db.prepare(`
      INSERT INTO audit_logs (id, branch_id, user_id, action, entity_type, entity_id, details, prev_hash, entry_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      branchIdStr,
      params.userId || null,
      params.action,
      params.entityType,
      entityIdStr,
      detailsStr,
      prevHash,
      entryHash,
      createdAt
    );
    return;
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

/**
 * Verifies the integrity of the entire audit log hash chain.
 * Returns { valid: true } if the chain is intact, or details of the first broken link.
 */
export function verifyAuditChain(): { valid: boolean; totalEntries: number; brokenAt?: string; message?: string } {
  const entries = db.prepare(
    'SELECT id, action, entity_type, entity_id, details, prev_hash, entry_hash, created_at FROM audit_logs WHERE entry_hash IS NOT NULL ORDER BY rowid ASC'
  ).all() as any[];

  if (entries.length === 0) return { valid: true, totalEntries: 0 };

  let expectedPrevHash = GENESIS_HASH;

  for (const entry of entries) {
    // Verify prev_hash linkage
    if (entry.prev_hash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenAt: entry.id,
        message: `Hash chain broken at entry ${entry.id}: prev_hash mismatch (expected ${expectedPrevHash.substring(0, 8)}..., got ${entry.prev_hash?.substring(0, 8)}...)`
      };
    }

    // Recompute and verify entry_hash
    const payload = `${entry.prev_hash}|${entry.id}|${entry.action}|${entry.entity_type}|${entry.entity_id || ''}|${entry.details || ''}|${entry.created_at}`;
    const recomputed = crypto.createHash('sha256').update(payload).digest('hex');

    if (recomputed !== entry.entry_hash) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenAt: entry.id,
        message: `Hash mismatch at entry ${entry.id}: audit log may have been tampered with`
      };
    }

    expectedPrevHash = entry.entry_hash;
  }

  return { valid: true, totalEntries: entries.length };
}


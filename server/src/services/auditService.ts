import { db } from '../database/schema.js';
import { v4 as uuidv4 } from 'uuid';

export function logAudit(params: {
  branchId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, any> | string;
}) {
  try {
    const detailsStr = typeof params.details === 'object' ? JSON.stringify(params.details) : params.details || '';
    db.prepare(`
      INSERT INTO audit_logs (id, branch_id, user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      params.branchId || null,
      params.userId || null,
      params.action,
      params.entityType,
      params.entityId || null,
      detailsStr
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

import { db } from '../database/schema.js';
import { v4 as uuidv4 } from 'uuid';

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
    db.prepare(`
      INSERT INTO audit_logs (id, branch_id, user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      branchIdStr,
      params.userId || null,
      params.action,
      params.entityType,
      entityIdStr,
      detailsStr
    );
    return;
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

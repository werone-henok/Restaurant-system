import { Router } from 'express';
import { db } from '../database/schema.js';
import { authenticate, authorizeRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit, verifyAuditChain } from '../services/auditService.js';
import { hashSecretSync } from '../utils/security.js';
import { validate } from '../middleware/validate.js';
import { createStaffSchema, updateUserStatusSchema } from '../schemas/api.schemas.js';
import { getSyncStatus, syncDatabaseToCloud } from '../services/cloudSyncService.js';

export const adminRouter = Router();

// 1. Get All Users (with branch name)
adminRouter.get('/users', authenticate, authorizeRole(['admin', 'owner']), (_req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.full_name, u.username, u.role, u.branch_id, u.phone, u.employee_id, u.status, u.created_at, b.name as branch_name
    FROM users u
    LEFT JOIN branches b ON u.branch_id = b.id
    ORDER BY u.created_at DESC
  `).all();
  res.json(users);
});

// Create new staff member directly (Admin & Owner)
adminRouter.post('/users', authenticate, authorizeRole(['admin', 'owner']), validate(createStaffSchema), (req: AuthenticatedRequest, res) => {
  const { full_name, username, password, phone, employee_id, role, branch_id, pin } = req.body;

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const password_hash = hashSecretSync(password);
  const pin_hash = pin ? hashSecretSync(pin) : null;

  db.prepare(`
    INSERT INTO users (id, full_name, username, password_hash, pin_hash, phone, employee_id, role, branch_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  `).run(id, full_name, username, password_hash, pin_hash, phone || null, employee_id || null, role, branch_id);

  logAudit({
    branchId: branch_id,
    userId: req.user!.id,
    action: 'STAFF_CREATED',
    entityType: 'USER',
    entityId: id,
    details: { full_name, username, role, branch_id }
  });

  res.status(201).json({ id, message: 'Staff member created successfully' });
});

// 2. Approve or Reject User Registration
adminRouter.patch('/users/:id/status', authenticate, authorizeRole(['admin', 'owner']), validate(updateUserStatusSchema), (req: AuthenticatedRequest, res) => {
  const { status, role, branch_id } = req.body;
  const targetId = req.params.id;

  db.prepare(`
    UPDATE users
    SET status = ?,
        role = COALESCE(?, role),
        branch_id = COALESCE(?, branch_id),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, role || null, branch_id || null, targetId);

  logAudit({
    userId: req.user!.id,
    action: `USER_STATUS_${status}`,
    entityType: 'USER',
    entityId: targetId,
    details: { newStatus: status, role, branch_id }
  });

  res.json({ message: `User status updated to ${status}` });
});

// 3. Update User Custom Permissions
adminRouter.post('/users/:id/permissions', authenticate, authorizeRole(['admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const targetId = req.params.id;
  const { permissions } = req.body; // Array of { permission: string, is_granted: 0 | 1 }

  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Permissions array required' });
  }

  const tx = db.transaction(() => {
    const upsertStmt = db.prepare(`
      INSERT INTO user_permissions (id, user_id, permission, is_granted)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, permission) DO UPDATE SET is_granted = excluded.is_granted
    `);

    for (const p of permissions) {
      upsertStmt.run(`perm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, targetId, p.permission, p.is_granted ? 1 : 0);
    }
  });

  tx();

  logAudit({
    userId: req.user!.id,
    action: 'PERMISSIONS_MODIFIED',
    entityType: 'USER',
    entityId: targetId,
    details: { updatedCount: permissions.length }
  });

  res.json({ message: 'User permissions updated successfully' });
});

// 4. Audit Logs Viewer
adminRouter.get('/audit-logs', authenticate, authorizeRole(['admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const branchId = req.query.branchId as string;
  let query = `
    SELECT a.*, u.full_name as user_name, u.role as user_role, b.name as branch_name
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN branches b ON a.branch_id = b.id
  `;
  const params: any[] = [];
  if (branchId && branchId !== 'ALL') {
    query += ` WHERE a.branch_id = ?`;
    params.push(branchId);
  }
  query += ` ORDER BY a.created_at DESC LIMIT 100`;

  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

// 5. Get and Update Restaurant / Branding Settings
adminRouter.get('/settings', authenticate, (_req, res) => {
  let settings = db.prepare('SELECT * FROM restaurant_settings LIMIT 1').get();
  if (!settings) {
    db.prepare(`
      INSERT INTO restaurant_settings (
        id, restaurant_name, slogan, primary_color, secondary_color, 
        vat_enabled, vat_percentage, tax_number, receipt_footer, receipt_footer_amharic, 
        default_currency, timezone_mode, system_timezone, timezone_offset_minutes
      ) VALUES (
        'settings_default', 'GourmetOS Restaurant & Lounge', 'Exquisite Taste & Seamless Hospitality',
        '#f97316', '#0f172a', 1, 15.0, 'TIN-0098471201',
        'Thank you for dining with us! Come again soon.', 'ስለመረጡን እናመሰግናለን! እንደገና ይምጡ።',
        'ETB', 'AUTO', 'Africa/Addis_Ababa', 180
      )
    `).run();
    settings = db.prepare('SELECT * FROM restaurant_settings LIMIT 1').get();
  }
  res.json(settings || {});
});

adminRouter.put('/settings', authenticate, authorizeRole(['admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const { 
    restaurant_name, slogan, primary_color, secondary_color, 
    vat_enabled, vat_percentage, tax_number, 
    receipt_footer, receipt_footer_amharic, default_currency,
    timezone_mode, system_timezone, timezone_offset_minutes 
  } = req.body;

  const existing = db.prepare('SELECT id FROM restaurant_settings LIMIT 1').get() as { id: string } | undefined;
  if (!existing) {
    db.prepare(`
      INSERT INTO restaurant_settings (
        id, restaurant_name, slogan, primary_color, secondary_color, 
        vat_enabled, vat_percentage, tax_number, receipt_footer, receipt_footer_amharic, 
        default_currency, timezone_mode, system_timezone, timezone_offset_minutes
      ) VALUES (
        'settings_default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      restaurant_name || 'GourmetOS Restaurant & Lounge',
      slogan || 'Exquisite Taste & Seamless Hospitality',
      primary_color || '#f97316',
      secondary_color || '#0f172a',
      vat_enabled ?? 1,
      vat_percentage ?? 15.0,
      tax_number || 'TIN-0098471201',
      receipt_footer || 'Thank you for dining with us! Come again soon.',
      receipt_footer_amharic || 'ስለመረጡን እናመሰግናለን! እንደገና ይምጡ።',
      default_currency || 'ETB',
      timezone_mode || 'AUTO',
      system_timezone || 'Africa/Addis_Ababa',
      timezone_offset_minutes ?? 180
    );
  } else {
    db.prepare(`
      UPDATE restaurant_settings
      SET restaurant_name = COALESCE(?, restaurant_name),
          slogan = COALESCE(?, slogan),
          primary_color = COALESCE(?, primary_color),
          secondary_color = COALESCE(?, secondary_color),
          vat_enabled = COALESCE(?, vat_enabled),
          vat_percentage = COALESCE(?, vat_percentage),
          tax_number = COALESCE(?, tax_number),
          receipt_footer = COALESCE(?, receipt_footer),
          receipt_footer_amharic = COALESCE(?, receipt_footer_amharic),
          default_currency = COALESCE(?, default_currency),
          timezone_mode = COALESCE(?, timezone_mode),
          system_timezone = COALESCE(?, system_timezone),
          timezone_offset_minutes = COALESCE(?, timezone_offset_minutes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      restaurant_name ?? null,
      slogan ?? null,
      primary_color ?? null,
      secondary_color ?? null,
      vat_enabled !== undefined ? vat_enabled : null,
      vat_percentage !== undefined ? vat_percentage : null,
      tax_number ?? null,
      receipt_footer ?? null,
      receipt_footer_amharic ?? null,
      default_currency ?? null,
      timezone_mode ?? null,
      system_timezone ?? null,
      timezone_offset_minutes !== undefined ? timezone_offset_minutes : null,
      existing.id
    );
  }

  const updatedSettings = db.prepare('SELECT * FROM restaurant_settings LIMIT 1').get();

  logAudit({
    userId: req.user!.id,
    action: 'SETTINGS_UPDATED',
    entityType: 'SETTINGS',
    details: req.body
  });

  res.json({ message: 'Settings updated successfully', settings: updatedSettings });
});

// 6. Cloud Database Sync (Render Free Tier Persistence)
adminRouter.get('/cloud-sync/status', authenticate, authorizeRole(['admin', 'owner']), (_req, res) => {
  res.json(getSyncStatus());
});

// Audit Log Integrity Verification (Owner-only)
// Verifies the cryptographic hash chain of audit logs to detect tampering.
adminRouter.get('/audit-integrity', authenticate, authorizeRole(['owner']), (_req, res) => {
  const result = verifyAuditChain();
  res.json(result);
});

// Audit Logs Viewer (Admin + Owner, read-only)
adminRouter.get('/audit-logs', authenticate, authorizeRole(['admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string || '100', 10), 500);
  const offset = parseInt(req.query.offset as string || '0', 10);
  const branchId = req.query.branchId as string;

  let query = `
    SELECT al.*, u.username, u.full_name
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (branchId && branchId !== 'ALL') {
    query += ' AND al.branch_id = ?';
    params.push(branchId);
  }

  query += ' ORDER BY al.rowid DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

adminRouter.post('/cloud-sync/trigger', authenticate, authorizeRole(['admin', 'owner']), async (_req, res) => {
  const result = await syncDatabaseToCloud('manual_admin_dashboard');
  if (result.success) {
    res.json({ success: true, message: result.message, status: getSyncStatus() });
  } else {
    res.status(500).json({ success: false, error: result.message, status: getSyncStatus() });
  }
});

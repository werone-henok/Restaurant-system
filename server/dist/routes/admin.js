import { Router } from 'express';
import { db } from '../database/schema.js';
import { authenticate, authorizeRole } from '../middleware/auth.js';
import { logAudit, verifyAuditChain } from '../services/auditService.js';
import { hashSecretSync } from '../utils/security.js';
import { validate } from '../middleware/validate.js';
import { createStaffSchema, updateUserStatusSchema } from '../schemas/api.schemas.js';
import { getSyncStatus, syncDatabaseToCloud } from '../services/cloudSyncService.js';
export const adminRouter = Router();
// 1. Get All Users (with branch name)
adminRouter.get('/users', authenticate, authorizeRole(['admin', 'owner']), (_req, res) => {
    const users = db.prepare(`
    SELECT u.id, u.full_name, u.username, u.role, u.branch_id, u.phone, u.employee_id, u.profile_photo, u.status, u.created_at, b.name as branch_name
    FROM users u
    LEFT JOIN branches b ON u.branch_id = b.id
    ORDER BY u.created_at DESC
  `).all();
    res.json(users);
});
// Create new staff member directly (Admin & Owner)
adminRouter.post('/users', authenticate, authorizeRole(['admin', 'owner']), validate(createStaffSchema), (req, res) => {
    const { full_name, username, password, phone, employee_id, role, branch_id, pin, profile_photo } = req.body;
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
        return res.status(400).json({ error: 'Username already exists' });
    }
    const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const password_hash = hashSecretSync(password);
    const pin_hash = pin ? hashSecretSync(pin) : null;
    db.prepare(`
    INSERT INTO users (id, full_name, username, password_hash, pin_hash, phone, employee_id, role, branch_id, profile_photo, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  `).run(id, full_name, username, password_hash, pin_hash, phone || null, employee_id || null, role, branch_id, profile_photo || null);
    logAudit({
        branchId: branch_id,
        userId: req.user.id,
        action: 'STAFF_CREATED',
        entityType: 'USER',
        entityId: id,
        details: { full_name, username, role, branch_id }
    });
    res.status(201).json({ id, message: 'Staff member created successfully' });
});
// Update Staff Member Profile Photo (Admin & Owner)
adminRouter.patch('/users/:id/photo', authenticate, authorizeRole(['admin', 'owner']), (req, res) => {
    const { profile_photo } = req.body;
    const targetId = req.params.id;
    db.prepare(`
    UPDATE users
    SET profile_photo = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(profile_photo || null, targetId);
    logAudit({
        userId: req.user.id,
        action: 'STAFF_PHOTO_UPDATED',
        entityType: 'USER',
        entityId: targetId
    });
    res.json({ success: true, message: 'Staff photo updated successfully', profile_photo });
});
// 2. Approve or Reject User Registration
adminRouter.patch('/users/:id/status', authenticate, authorizeRole(['admin', 'owner']), validate(updateUserStatusSchema), (req, res) => {
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
        userId: req.user.id,
        action: `USER_STATUS_${status}`,
        entityType: 'USER',
        entityId: targetId,
        details: { newStatus: status, role, branch_id }
    });
    res.json({ message: `User status updated to ${status}` });
});
// 3. Update User Custom Permissions
adminRouter.post('/users/:id/permissions', authenticate, authorizeRole(['admin', 'owner']), (req, res) => {
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
        userId: req.user.id,
        action: 'PERMISSIONS_MODIFIED',
        entityType: 'USER',
        entityId: targetId,
        details: { updatedCount: permissions.length }
    });
    res.json({ message: 'User permissions updated successfully' });
});
// 4. Audit Logs Viewer
adminRouter.get('/audit-logs', authenticate, authorizeRole(['admin', 'owner']), (req, res) => {
    const branchId = req.query.branchId;
    let query = `
    SELECT a.*, u.full_name as user_name, u.role as user_role, b.name as branch_name
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN branches b ON a.branch_id = b.id
  `;
    const params = [];
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
        id, restaurant_name, slogan, logo_url, primary_color, secondary_color, 
        vat_enabled, vat_percentage, tax_number, receipt_footer, receipt_footer_amharic, 
        default_currency, timezone_mode, system_timezone, timezone_offset_minutes
      ) VALUES (
        'settings_default', 'Yo Burger & Restaurant', 'Delicious Burgers & Seamless Hospitality', '/logo.png',
        '#ff9e01', '#940500', 1, 15.0, 'TIN-0098471201',
        'Thank you for dining with us! Come again soon.', 'ስለመረጡን እናመሰግናለን! እንደገና ይምጡ።',
        'ETB', 'AUTO', 'Africa/Addis_Ababa', 180
      )
    `).run();
        settings = db.prepare('SELECT * FROM restaurant_settings LIMIT 1').get();
    }
    res.json(settings || {});
});
adminRouter.put('/settings', authenticate, authorizeRole(['admin', 'owner']), (req, res) => {
    const { restaurant_name, slogan, primary_color, secondary_color, vat_enabled, vat_percentage, tax_number, receipt_footer, receipt_footer_amharic, default_currency, timezone_mode, system_timezone, timezone_offset_minutes } = req.body;
    const existing = db.prepare('SELECT id FROM restaurant_settings LIMIT 1').get();
    if (!existing) {
        db.prepare(`
      INSERT INTO restaurant_settings (
        id, restaurant_name, slogan, primary_color, secondary_color, 
        vat_enabled, vat_percentage, tax_number, receipt_footer, receipt_footer_amharic, 
        default_currency, timezone_mode, system_timezone, timezone_offset_minutes
      ) VALUES (
        'settings_default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(restaurant_name || 'Yo Burger & Restaurant', slogan || 'Delicious Burgers & Seamless Hospitality', primary_color || '#ff9e01', secondary_color || '#940500', vat_enabled ?? 1, vat_percentage ?? 15.0, tax_number || 'TIN-0098471201', receipt_footer || 'Thank you for dining with us! Come again soon.', receipt_footer_amharic || 'ስለመረጡን እናመሰግናለን! እንደገና ይምጡ።', default_currency || 'ETB', timezone_mode || 'AUTO', system_timezone || 'Africa/Addis_Ababa', timezone_offset_minutes ?? 180);
    }
    else {
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
    `).run(restaurant_name ?? null, slogan ?? null, primary_color ?? null, secondary_color ?? null, vat_enabled !== undefined ? vat_enabled : null, vat_percentage !== undefined ? vat_percentage : null, tax_number ?? null, receipt_footer ?? null, receipt_footer_amharic ?? null, default_currency ?? null, timezone_mode ?? null, system_timezone ?? null, timezone_offset_minutes !== undefined ? timezone_offset_minutes : null, existing.id);
    }
    const updatedSettings = db.prepare('SELECT * FROM restaurant_settings LIMIT 1').get();
    logAudit({
        userId: req.user.id,
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
adminRouter.get('/audit-logs', authenticate, authorizeRole(['admin', 'owner']), (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const offset = parseInt(req.query.offset || '0', 10);
    const branchId = req.query.branchId;
    let query = `
    SELECT al.*, u.username, u.full_name
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
    const params = [];
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
    }
    else {
        res.status(500).json({ success: false, error: result.message, status: getSyncStatus() });
    }
});
adminRouter.post('/clean-demo-data', authenticate, authorizeRole(['admin', 'owner']), async (req, res) => {
    const tablesToClean = [
        'order_items',
        'order_status_history',
        'payments',
        'receipts',
        'orders',
        'order_counters',
        'recipe_items',
        'recipes',
        'menu_items',
        'menu_categories',
        'inventory_movements',
        'inventory_stock',
        'waste_records',
        'purchase_order_items',
        'purchase_orders',
        'stock_transfer_items',
        'stock_transfers',
        'ingredients',
        'suppliers',
        'restaurant_tables',
        'bakery_inventory_transactions',
        'bakery_waste_records',
        'bakery_returns',
        'bakery_stock_counts',
        'bakery_price_suggestions',
        'bakery_transfers',
        'bakery_requests',
        'bakery_batches',
        'bakery_product_variations',
        'bakery_products',
        'expenses',
        'attendance',
        'notifications',
        'audit_logs',
        'user_account_requests'
    ];
    try {
        db.pragma('foreign_keys = OFF');
        const tx = db.transaction(() => {
            for (const tableName of tablesToClean) {
                try {
                    const info = db.prepare(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
                    if (info && info.count > 0) {
                        db.prepare(`DELETE FROM ${tableName}`).run();
                    }
                }
                catch (_) { }
            }
        });
        tx();
        db.pragma('foreign_keys = ON');
        try {
            db.exec('VACUUM');
        }
        catch (_) { }
        // Trigger immediate cloud backup so cloud persistence stores the clean state
        await syncDatabaseToCloud('post_clean_demo_data');
        logAudit({
            branchId: req.user?.branch_id || 'branch_addis',
            userId: req.user.id,
            action: 'DEMO_DATA_CLEANED',
            entityType: 'DATABASE',
            details: { cleanedBy: req.user?.username }
        });
        res.json({
            success: true,
            message: 'Demo catalog (menu items, tables, ingredients, cakes, orders) cleaned successfully! Staff accounts and settings preserved.'
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to clean demo data' });
    }
});
// 8. Delete Staff Member (Owner & Admin only; cannot delete Owner or self)
adminRouter.delete('/users/:id', authenticate, authorizeRole(['admin', 'owner']), (req, res) => {
    const targetId = req.params.id;
    const targetUser = db.prepare('SELECT id, username, role, full_name FROM users WHERE id = ?').get(targetId);
    if (!targetUser) {
        return res.status(404).json({ error: 'Staff member not found' });
    }
    if (targetUser.role === 'owner') {
        return res.status(403).json({ error: 'Owner account cannot be deleted' });
    }
    if (req.user?.id === targetId) {
        return res.status(400).json({ error: 'You cannot delete your own active account' });
    }
    try {
        const owner = db.prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1").get();
        const fallbackUserId = owner?.id || req.user?.id || 'usr_owner';
        // Temporarily disable foreign keys for safe cascading and unbinding
        db.pragma('foreign_keys = OFF');
        try {
            const safeRun = (sql, ...params) => {
                try {
                    db.prepare(sql).run(...params);
                }
                catch (_) { }
            };
            // 1. Direct dependencies: permissions, account requests, notifications, attendance
            safeRun('DELETE FROM user_permissions WHERE user_id = ?', targetId);
            safeRun('DELETE FROM user_account_requests WHERE user_id = ?', targetId);
            safeRun('UPDATE user_account_requests SET reviewed_by_id = NULL WHERE reviewed_by_id = ?', targetId);
            safeRun('DELETE FROM notifications WHERE target_user_id = ?', targetId);
            safeRun('DELETE FROM attendance WHERE user_id = ?', targetId);
            // 2. Audit history: keep audit rows but set user_id to NULL
            safeRun('UPDATE audit_logs SET user_id = NULL WHERE user_id = ?', targetId);
            // 3. Operational & Sales references: reassign required columns to owner, nullify optional ones
            safeRun('UPDATE expenses SET user_id = ? WHERE user_id = ?', fallbackUserId, targetId);
            safeRun('UPDATE orders SET waiter_id = ? WHERE waiter_id = ?', fallbackUserId, targetId);
            safeRun('UPDATE orders SET cashier_id = NULL WHERE cashier_id = ?', targetId);
            safeRun('UPDATE orders SET discount_approver_id = NULL WHERE discount_approver_id = ?', targetId);
            safeRun('UPDATE orders SET cancelled_by_id = NULL WHERE cancelled_by_id = ?', targetId);
            safeRun('UPDATE order_items SET prepared_by_id = NULL WHERE prepared_by_id = ?', targetId);
            safeRun('UPDATE order_status_history SET user_id = NULL WHERE user_id = ?', targetId);
            safeRun('UPDATE payments SET cashier_id = ? WHERE cashier_id = ?', fallbackUserId, targetId);
            safeRun('UPDATE waste_records SET storekeeper_id = ? WHERE storekeeper_id = ?', fallbackUserId, targetId);
            safeRun('UPDATE purchase_orders SET user_id = ? WHERE user_id = ?', fallbackUserId, targetId);
            safeRun('UPDATE stock_requests SET requested_by_id = ? WHERE requested_by_id = ?', fallbackUserId, targetId);
            safeRun('UPDATE stock_requests SET approved_by_id = NULL WHERE approved_by_id = ?', targetId);
            safeRun('UPDATE stock_transfers SET user_id = ? WHERE user_id = ?', fallbackUserId, targetId);
            // 4. Bakery & Front Counter modules
            safeRun('UPDATE bakery_batches SET produced_by_id = ? WHERE produced_by_id = ?', fallbackUserId, targetId);
            safeRun('UPDATE bakery_transfers SET created_by_id = ? WHERE created_by_id = ?', fallbackUserId, targetId);
            safeRun('UPDATE bakery_transfers SET sent_by_id = NULL WHERE sent_by_id = ?', targetId);
            safeRun('UPDATE bakery_transfers SET received_by_id = NULL WHERE received_by_id = ?', targetId);
            safeRun('UPDATE bakery_requests SET requested_by_id = ? WHERE requested_by_id = ?', fallbackUserId, targetId);
            safeRun('UPDATE bakery_requests SET handled_by_id = NULL WHERE handled_by_id = ?', targetId);
            safeRun('UPDATE bakery_waste_records SET user_id = ? WHERE user_id = ?', fallbackUserId, targetId);
            safeRun('UPDATE bakery_stock_counts SET counted_by_id = ? WHERE counted_by_id = ?', fallbackUserId, targetId);
            safeRun('UPDATE bakery_price_suggestions SET suggested_by_id = ? WHERE suggested_by_id = ?', fallbackUserId, targetId);
            safeRun('UPDATE bakery_price_suggestions SET reviewed_by_id = NULL WHERE reviewed_by_id = ?', targetId);
            safeRun('UPDATE bakery_returns SET user_id = ? WHERE user_id = ?', fallbackUserId, targetId);
            safeRun('UPDATE bakery_inventory_transactions SET user_id = ? WHERE user_id = ?', fallbackUserId, targetId);
            // 5. Delete the user
            db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
        }
        finally {
            db.pragma('foreign_keys = ON');
        }
        logAudit({
            userId: req.user.id,
            action: 'USER_DELETED',
            entityType: 'USER',
            entityId: targetId,
            details: { deletedUsername: targetUser.username, role: targetUser.role }
        });
        res.json({ success: true, message: `Staff member ${targetUser.full_name || targetUser.username} deleted successfully` });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to delete user' });
    }
});
// 9. Wipe All Sales History & Orders Data
adminRouter.post('/wipe-sales', authenticate, authorizeRole(['admin', 'owner']), async (req, res) => {
    const salesTables = [
        'order_items',
        'order_status_history',
        'payments',
        'receipts',
        'orders',
        'order_counters'
    ];
    try {
        db.pragma('foreign_keys = OFF');
        const tx = db.transaction(() => {
            for (const t of salesTables) {
                try {
                    db.prepare(`DELETE FROM ${t}`).run();
                }
                catch (_) { }
            }
        });
        tx();
        db.pragma('foreign_keys = ON');
        try {
            db.exec('VACUUM');
        }
        catch (_) { }
        await syncDatabaseToCloud('post_wipe_sales');
        logAudit({
            branchId: req.user?.branch_id || 'branch_addis',
            userId: req.user.id,
            action: 'SALES_WIPED',
            entityType: 'DATABASE',
            details: { wipedBy: req.user?.username }
        });
        res.json({ success: true, message: 'All sales history, completed orders, payments, and receipts wiped successfully.' });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to wipe sales history' });
    }
});
// 10. Wipe All Expenses History & Purchases Data
adminRouter.post('/wipe-expenses', authenticate, authorizeRole(['admin', 'owner']), async (req, res) => {
    const expenseTables = [
        'expenses',
        'purchase_order_items',
        'purchase_orders',
        'waste_records'
    ];
    try {
        db.pragma('foreign_keys = OFF');
        const tx = db.transaction(() => {
            for (const t of expenseTables) {
                try {
                    db.prepare(`DELETE FROM ${t}`).run();
                }
                catch (_) { }
            }
        });
        tx();
        db.pragma('foreign_keys = ON');
        try {
            db.exec('VACUUM');
        }
        catch (_) { }
        await syncDatabaseToCloud('post_wipe_expenses');
        logAudit({
            branchId: req.user?.branch_id || 'branch_addis',
            userId: req.user.id,
            action: 'EXPENSES_WIPED',
            entityType: 'DATABASE',
            details: { wipedBy: req.user?.username }
        });
        res.json({ success: true, message: 'All expense records, purchase orders, and waste records wiped successfully.' });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to wipe expenses history' });
    }
});

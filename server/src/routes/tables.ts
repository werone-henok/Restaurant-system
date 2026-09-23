import { Router } from 'express';
import { db } from '../database/schema.js';
import { authenticate, authorizeRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { v4 as uuidv4 } from 'uuid';

export const tableRouter = Router();

// Get tables for a branch
tableRouter.get('/', authenticate, (req: AuthenticatedRequest, res) => {
  const rawBranchId = req.query.branchId as string;
  const isAll = rawBranchId === 'ALL' || (!rawBranchId && (req.user?.role === 'owner' || req.user?.role === 'admin') && !req.user?.branch_id);
  const branchId = isAll ? null : (rawBranchId || req.user!.branch_id);

  if (branchId) {
    const tables = db.prepare('SELECT * FROM restaurant_tables WHERE branch_id = ? AND is_active = 1 ORDER BY table_number ASC').all(branchId);
    return res.json(tables);
  }
  const tables = db.prepare('SELECT * FROM restaurant_tables WHERE is_active = 1 ORDER BY table_number ASC').all();
  res.json(tables);
});

// Update table status (e.g. AVAILABLE, OCCUPIED, RESERVED)
tableRouter.patch('/:id/status', authenticate, (req: AuthenticatedRequest, res) => {
  const { status } = req.body;
  db.prepare('UPDATE restaurant_tables SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ message: 'Table status updated', status });
});

// Create new table (Admin/Owner)
tableRouter.post('/', authenticate, authorizeRole(['admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const { branch_id, table_number, name, section, capacity } = req.body;
  const targetBranch = branch_id || req.user!.branch_id;
  const id = `tbl_${uuidv4().substring(0, 8)}`;

  db.prepare(`
    INSERT INTO restaurant_tables (id, branch_id, table_number, name, section, capacity, status)
    VALUES (?, ?, ?, ?, ?, ?, 'AVAILABLE')
  `).run(id, targetBranch, table_number, name, section || 'Main Hall', capacity || 4);

  logAudit({
    branchId: targetBranch,
    userId: req.user!.id,
    action: 'TABLE_CREATED',
    entityType: 'TABLE',
    entityId: id,
    details: { table_number, name, section }
  });

  res.status(201).json({ id, table_number, name, section, capacity });
});

// Update table (Admin/Owner)
tableRouter.put('/:id', authenticate, authorizeRole(['admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const { table_number, name, section, capacity } = req.body;

  db.prepare(`
    UPDATE restaurant_tables
    SET table_number = COALESCE(?, table_number),
        name = COALESCE(?, name),
        section = COALESCE(?, section),
        capacity = COALESCE(?, capacity)
    WHERE id = ?
  `).run(table_number, name, section, capacity, req.params.id);

  logAudit({
    userId: req.user!.id,
    action: 'TABLE_UPDATED',
    entityType: 'TABLE',
    entityId: req.params.id,
    details: req.body
  });

  res.json({ message: 'Table updated successfully' });
});

// Delete table (Admin/Owner)
tableRouter.delete('/:id', authenticate, authorizeRole(['admin', 'owner']), (req: AuthenticatedRequest, res) => {
  db.prepare('UPDATE restaurant_tables SET is_active = 0 WHERE id = ?').run(req.params.id);

  logAudit({
    userId: req.user!.id,
    action: 'TABLE_DELETED',
    entityType: 'TABLE',
    entityId: req.params.id
  });

  res.json({ message: 'Table removed successfully' });
});

// Get all unique sections for a branch
tableRouter.get('/sections', authenticate, (req: AuthenticatedRequest, res) => {
  const branchId = (req.query.branchId as string) || req.user!.branch_id;
  const rows = db.prepare('SELECT DISTINCT section FROM restaurant_tables WHERE branch_id = ? AND is_active = 1').all(branchId) as { section: string }[];
  res.json(rows.map(r => r.section));
});

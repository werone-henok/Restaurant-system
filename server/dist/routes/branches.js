import { Router } from 'express';
import { db } from '../database/schema.js';
import { authenticate, authorizeRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { v4 as uuidv4 } from 'uuid';
export const branchRouter = Router();
// Get list of all branches
branchRouter.get('/', authenticate, (req, res) => {
    const branches = db.prepare('SELECT * FROM branches WHERE is_active = 1 ORDER BY name ASC').all();
    res.json(branches);
});
// Get single branch
branchRouter.get('/:id', authenticate, (req, res) => {
    const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id);
    if (!branch)
        return res.status(404).json({ error: 'Branch not found' });
    res.json(branch);
});
// Create new branch (Admin & Owner)
branchRouter.post('/', authenticate, authorizeRole(['admin', 'owner']), (req, res) => {
    const { name, city, address, phone, tax_number, vat_rate } = req.body;
    if (!name || !city) {
        return res.status(400).json({ error: 'Branch name and city are required' });
    }
    const id = `branch_${uuidv4().substring(0, 8)}`;
    db.prepare(`
    INSERT INTO branches (id, name, city, address, phone, tax_number, vat_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, city, address || '', phone || '', tax_number || '', vat_rate !== undefined ? vat_rate : 0.15);
    logAudit({
        branchId: id,
        userId: req.user.id,
        action: 'BRANCH_CREATED',
        entityType: 'BRANCH',
        entityId: id,
        details: { name, city }
    });
    res.status(201).json({ id, name, city, address, phone });
});
// Update branch (Admin & Owner)
branchRouter.put('/:id', authenticate, authorizeRole(['admin', 'owner']), (req, res) => {
    const { name, city, address, phone, tax_number, vat_rate } = req.body;
    db.prepare(`
    UPDATE branches
    SET name = COALESCE(?, name),
        city = COALESCE(?, city),
        address = COALESCE(?, address),
        phone = COALESCE(?, phone),
        tax_number = COALESCE(?, tax_number),
        vat_rate = COALESCE(?, vat_rate)
    WHERE id = ?
  `).run(name, city, address, phone, tax_number, vat_rate, req.params.id);
    logAudit({
        branchId: req.params.id,
        userId: req.user.id,
        action: 'BRANCH_UPDATED',
        entityType: 'BRANCH',
        entityId: req.params.id,
        details: req.body
    });
    res.json({ message: 'Branch updated successfully' });
});
// Delete (Deactivate) branch (Admin & Owner)
branchRouter.delete('/:id', authenticate, authorizeRole(['admin', 'owner']), (req, res) => {
    const branchId = req.params.id;
    // Soft delete branch by setting is_active = 0 to protect historical financial records
    db.prepare('UPDATE branches SET is_active = 0 WHERE id = ?').run(branchId);
    logAudit({
        branchId,
        userId: req.user.id,
        action: 'BRANCH_DELETED',
        entityType: 'BRANCH',
        entityId: branchId,
        details: { branchId }
    });
    res.json({ message: 'Branch removed successfully' });
});

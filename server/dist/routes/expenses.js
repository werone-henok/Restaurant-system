import { Router } from 'express';
import { db } from '../database/schema.js';
import { authenticate, authorizeRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { v4 as uuidv4 } from 'uuid';
export const expenseRouter = Router();
// 1. Get Expenses with category & date filters
expenseRouter.get('/', authenticate, (req, res) => {
    const branchId = req.query.branchId || req.user.branch_id;
    const category = req.query.category;
    let query = `
    SELECT e.*, u.full_name as created_by_name, s.name as supplier_name
    FROM expenses e
    JOIN users u ON e.user_id = u.id
    LEFT JOIN suppliers s ON e.supplier_id = s.id
    WHERE e.branch_id = ?
  `;
    const params = [branchId];
    if (category) {
        query += ` AND e.category = ?`;
        params.push(category);
    }
    query += ` ORDER BY e.expense_date DESC, e.created_at DESC`;
    const expenses = db.prepare(query).all(...params);
    res.json(expenses);
});
// 2. Record Expense
expenseRouter.post('/', authenticate, authorizeRole(['admin', 'owner']), (req, res) => {
    const { branch_id, category, amount, expense_date, description, receipt_photo_url, supplier_id, reference_number } = req.body;
    if (!category || !amount || !description) {
        return res.status(400).json({ error: 'Category, amount, and description are required' });
    }
    const targetBranch = branch_id || req.user.branch_id;
    const id = `exp_${uuidv4().substring(0, 8)}`;
    db.prepare(`
    INSERT INTO expenses (id, branch_id, user_id, category, amount, expense_date, description, receipt_photo_url, supplier_id, reference_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, targetBranch, req.user.id, category, amount, expense_date || new Date().toISOString().split('T')[0], description, receipt_photo_url || null, supplier_id || null, reference_number || null);
    logAudit({
        branchId: targetBranch,
        userId: req.user.id,
        action: 'EXPENSE_RECORDED',
        entityType: 'EXPENSE',
        entityId: id,
        details: { category, amount, description }
    });
    res.status(201).json({ id, message: 'Expense recorded successfully' });
});

import { Router } from 'express';
import { db } from '../database/schema.js';
import { authenticate } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { v4 as uuidv4 } from 'uuid';
export const attendanceRouter = Router();
// 1. Clock In
attendanceRouter.post('/clock-in', authenticate, (req, res) => {
    const branchId = req.user.branch_id;
    const userId = req.user.id;
    // Check if already clocked in today without clock out
    const activeShift = db.prepare(`
    SELECT id FROM attendance 
    WHERE user_id = ? AND clock_out IS NULL
    ORDER BY clock_in DESC LIMIT 1
  `).get(userId);
    if (activeShift) {
        return res.status(400).json({ error: 'You are already clocked in.' });
    }
    const id = uuidv4();
    db.prepare(`
    INSERT INTO attendance (id, user_id, branch_id, clock_in)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `).run(id, userId, branchId);
    logAudit({
        branchId,
        userId,
        action: 'CLOCK_IN',
        entityType: 'ATTENDANCE',
        entityId: id,
        details: { employee: req.user.full_name }
    });
    res.json({ message: 'Clocked in successfully', id, clockInTime: new Date().toISOString() });
});
// 2. Clock Out
attendanceRouter.post('/clock-out', authenticate, (req, res) => {
    const userId = req.user.id;
    const activeShift = db.prepare(`
    SELECT id, clock_in FROM attendance 
    WHERE user_id = ? AND clock_out IS NULL
    ORDER BY clock_in DESC LIMIT 1
  `).get(userId);
    if (!activeShift) {
        return res.status(400).json({ error: 'No active clocked-in shift found.' });
    }
    const clockInTime = new Date(activeShift.clock_in).getTime();
    const clockOutTime = Date.now();
    const diffHours = +((clockOutTime - clockInTime) / (1000 * 60 * 60)).toFixed(2);
    db.prepare(`
    UPDATE attendance
    SET clock_out = CURRENT_TIMESTAMP,
        total_hours = ?
    WHERE id = ?
  `).run(diffHours, activeShift.id);
    logAudit({
        branchId: req.user.branch_id,
        userId,
        action: 'CLOCK_OUT',
        entityType: 'ATTENDANCE',
        entityId: activeShift.id,
        details: { hours: diffHours }
    });
    res.json({ message: 'Clocked out successfully', totalHours: diffHours });
});
// 3. Get Attendance History
attendanceRouter.get('/', authenticate, (req, res) => {
    const branchId = req.query.branchId || req.user.branch_id;
    let query = `
    SELECT a.*, u.full_name, u.role, u.employee_id
    FROM attendance a
    JOIN users u ON a.user_id = u.id
    WHERE a.branch_id = ?
  `;
    const params = [branchId];
    if (req.user.role === 'waiter' || req.user.role === 'chef' || req.user.role === 'barista') {
        query += ` AND a.user_id = ?`;
        params.push(req.user.id);
    }
    query += ` ORDER BY a.clock_in DESC LIMIT 50`;
    const logs = db.prepare(query).all(...params);
    res.json(logs);
});

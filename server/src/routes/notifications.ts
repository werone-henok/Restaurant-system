import { Router } from 'express';
import { db } from '../database/schema.js';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js';

export const notificationRouter = Router();

// 1. Get notifications for the current user/role
notificationRouter.get('/', authenticate, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const branchId = (req.query.branchId as string) || user.branch_id;
  const isOwner = user.role === 'owner';

  let query = `
    SELECT * FROM notifications
    WHERE (target_role IS NULL OR target_role = 'all' OR target_role = ? OR target_user_id = ?)
  `;
  const params: any[] = [user.role, user.id];

  if (!isOwner && branchId) {
    query += ` AND (branch_id = ? OR branch_id IS NULL)`;
    params.push(branchId);
  }

  query += ` ORDER BY created_at DESC LIMIT 50`;

  const notifications = db.prepare(query).all(...params) as any[];

  // Calculate unread count
  let unreadQuery = `
    SELECT COUNT(*) as count FROM notifications
    WHERE is_read = 0
      AND (target_role IS NULL OR target_role = 'all' OR target_role = ? OR target_user_id = ?)
  `;
  const unreadParams: any[] = [user.role, user.id];
  if (!isOwner && branchId) {
    unreadQuery += ` AND (branch_id = ? OR branch_id IS NULL)`;
    unreadParams.push(branchId);
  }

  const unreadRow = db.prepare(unreadQuery).get(...unreadParams) as { count: number };

  res.json({
    notifications,
    unreadCount: unreadRow?.count || 0
  });
});

// 2. Mark a single notification as read
notificationRouter.patch('/:id/read', authenticate, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
  res.json({ message: 'Notification marked as read', id });
});

// 3. Mark all notifications as read for this user/role
notificationRouter.patch('/read-all', authenticate, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const branchId = (req.query.branchId as string) || user.branch_id;

  let query = `
    UPDATE notifications SET is_read = 1
    WHERE is_read = 0
      AND (target_role IS NULL OR target_role = 'all' OR target_role = ? OR target_user_id = ?)
  `;
  const params: any[] = [user.role, user.id];

  if (user.role !== 'owner' && branchId) {
    query += ` AND (branch_id = ? OR branch_id IS NULL)`;
    params.push(branchId);
  }

  db.prepare(query).run(...params);
  res.json({ message: 'All notifications marked as read' });
});

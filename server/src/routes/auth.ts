import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/schema.js';
import { CONFIG } from '../config/env.js';
import { authenticate, authorizeRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { broadcastEvent } from '../services/websocket.js';

export const authRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 1. User Login
authRouter.post('/login', (req, res) => {
  const { username, password, pin } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  // If logging in with password
  if (password) {
    if (user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
  } else if (pin) {
    // PIN quick login
    if (!user.pin_hash || user.pin_hash !== hashPassword(pin)) {
      return res.status(401).json({ error: 'Invalid PIN.' });
    }
  } else {
    return res.status(400).json({ error: 'Password or PIN required.' });
  }

  if (user.status === 'PENDING_APPROVAL') {
    return res.status(403).json({ error: 'Account registration is pending Administrator approval.' });
  }
  if (user.status !== 'ACTIVE') {
    return res.status(403).json({ error: `Account is ${user.status}. Contact administrator.` });
  }

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      branch_id: user.branch_id,
      full_name: user.full_name
    },
    CONFIG.JWT_SECRET as string,
    { expiresIn: '7d' }
  );

  // Get user custom permissions
  const permissions = db.prepare('SELECT permission, is_granted FROM user_permissions WHERE user_id = ?').all(user.id);

  logAudit({
    branchId: user.branch_id,
    userId: user.id,
    action: 'USER_LOGIN',
    entityType: 'USER',
    entityId: user.id,
    details: { username: user.username, role: user.role }
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      branch_id: user.branch_id,
      phone: user.phone,
      employee_id: user.employee_id,
      profile_photo: user.profile_photo,
      status: user.status
    },
    permissions
  });
});

// 2. User Self-Registration
authRouter.post('/register', (req, res) => {
  const { full_name, username, password, pin, phone, employee_id, requested_role, branch_id, profile_photo } = req.body;

  if (!full_name || !username || !password || !requested_role || !branch_id) {
    return res.status(400).json({ error: 'Full name, username, password, requested role and branch are required.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: 'Username is already taken.' });
  }

  const id = uuidv4();
  const password_hash = hashPassword(password);
  const pin_hash = pin ? hashPassword(pin) : null;

  db.prepare(`
    INSERT INTO users (id, full_name, username, password_hash, pin_hash, phone, employee_id, role, branch_id, profile_photo, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
  `).run(id, full_name, username, password_hash, pin_hash, phone || null, employee_id || null, requested_role, branch_id, profile_photo || null);

  // Notify admins and owner
  broadcastEvent({
    type: 'NEW_USER_REGISTRATION',
    branchId: branch_id,
    targetRole: ['admin', 'owner'],
    payload: { id, full_name, username, requested_role, branch_id }
  });

  logAudit({
    branchId: branch_id,
    userId: id,
    action: 'USER_REGISTERED',
    entityType: 'USER',
    entityId: id,
    details: { full_name, username, requested_role }
  });

  res.status(201).json({
    message: 'Registration submitted successfully. Waiting for Administrator or Owner approval.',
    userId: id
  });
});

// 3. Current User Profile
authRouter.get('/me', authenticate, (req: AuthenticatedRequest, res) => {
  const user = db.prepare('SELECT id, full_name, username, phone, employee_id, role, branch_id, profile_photo, status FROM users WHERE id = ?').get(req.user!.id);
  const permissions = db.prepare('SELECT permission, is_granted FROM user_permissions WHERE user_id = ?').all(req.user!.id);
  res.json({ user, permissions });
});

// 4. Verify PIN for Sensitive Actions (Manager Override)
authRouter.post('/verify-pin', authenticate, (req: AuthenticatedRequest, res) => {
  const { pin, userId } = req.body;
  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  const targetUserId = userId || req.user!.id;
  const targetUser = db.prepare('SELECT pin_hash, role, full_name FROM users WHERE id = ?').get(targetUserId) as any;

  if (!targetUser || !targetUser.pin_hash) {
    return res.status(400).json({ error: 'User does not have a configured authorization PIN' });
  }

  if (targetUser.pin_hash !== hashPassword(pin)) {
    return res.status(401).json({ error: 'Invalid authorization PIN' });
  }

  res.json({ verified: true, authorizedBy: targetUser.full_name, role: targetUser.role });
});

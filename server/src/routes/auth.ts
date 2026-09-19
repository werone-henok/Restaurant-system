import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/schema.js';
import { CONFIG } from '../config/env.js';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { broadcastEvent } from '../services/websocket.js';
import { hashSecret, verifySecret } from '../utils/security.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema, verifyPinSchema } from '../schemas/api.schemas.js';

export const authRouter = Router();

// 1. User Login
authRouter.post('/login', validate(loginSchema), async (req, res) => {
  const { username, password, pin } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  // Verify credential (bcrypt-aware, SHA-256 backward-compatible)
  if (password) {
    const valid = await verifySecret(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
  } else if (pin) {
    if (!user.pin_hash) {
      return res.status(401).json({ error: 'Invalid PIN.' });
    }
    const valid = await verifySecret(pin, user.pin_hash);
    if (!valid) {
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
authRouter.post('/register', validate(registerSchema), async (req, res) => {
  const { full_name, username, password, pin, phone, employee_id, requested_role, branch_id, profile_photo } = req.body;

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: 'Username is already taken.' });
  }

  const id = uuidv4();
  const password_hash = await hashSecret(password);
  const pin_hash = pin ? await hashSecret(pin) : null;

  db.prepare(`
    INSERT INTO users (id, full_name, username, password_hash, pin_hash, phone, employee_id, role, branch_id, profile_photo, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')
  `).run(id, full_name, username, password_hash, pin_hash, phone || null, employee_id || null, requested_role, branch_id, profile_photo || null);

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
authRouter.post('/verify-pin', authenticate, validate(verifyPinSchema), async (req: AuthenticatedRequest, res) => {
  const { pin, userId } = req.body;

  const targetUserId = userId || req.user!.id;
  const targetUser = db.prepare('SELECT pin_hash, role, full_name FROM users WHERE id = ?').get(targetUserId) as any;

  if (!targetUser || !targetUser.pin_hash) {
    return res.status(400).json({ error: 'User does not have a configured authorization PIN' });
  }

  const valid = await verifySecret(pin, targetUser.pin_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid authorization PIN' });
  }

  res.json({ verified: true, authorizedBy: targetUser.full_name, role: targetUser.role });
});

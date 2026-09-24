import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/schema.js';
import { CONFIG } from '../config/env.js';
import { authenticate, blacklistToken, type AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { broadcastEvent } from '../services/websocket.js';
import { hashSecret, verifySecret } from '../utils/security.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema, verifyPinSchema } from '../schemas/api.schemas.js';

export const authRouter = Router();

// Helper to log failed login and check for brute-force attacks
function handleFailedLogin(userId: string | null, username: string, branchId: string | null, reqIp?: string) {
  logAudit({
    branchId: branchId || 'branch_addis',
    userId: userId || undefined,
    action: 'LOGIN_FAILED',
    entityType: 'USER',
    entityId: userId || undefined,
    details: { username, ip: reqIp || 'unknown' }
  });

  if (userId) {
    const failureRow = db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs
      WHERE action = 'LOGIN_FAILED' AND entity_id = ? AND created_at > datetime('now', '-1 hour')
    `).get(userId) as { count: number };

    if (failureRow && failureRow.count >= 10) {
      broadcastEvent({
        type: 'SUSPICIOUS_ACTIVITY',
        branchId: branchId || 'branch_addis',
        targetRole: ['admin', 'owner'],
        payload: {
          userId,
          username,
          attempts: failureRow.count,
          message: `Over 10 failed login attempts detected in the last hour for account: ${username}`
        }
      });
    }
  }
}

// 1. User Login (Issues 2-hour Access Token + 7-day Refresh Token)
authRouter.post('/login', validate(loginSchema), async (req, res) => {
  const { username, password, pin } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND deleted_at IS NULL').get(username) as any;
  if (!user) {
    handleFailedLogin(null, username, null, req.ip);
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  // Check if account is temporarily locked due to password attempts
  if (user.login_locked_until) {
    const lockExpiry = new Date(user.login_locked_until);
    if (lockExpiry > new Date()) {
      const remainingMinutes = Math.ceil((lockExpiry.getTime() - Date.now()) / 60000);
      return res.status(429).json({
        error: `Account is temporarily locked due to excessive failed login attempts. Try again in ${remainingMinutes} minute(s).`
      });
    }
  }

  // Verify credential (bcrypt-aware, SHA-256 backward-compatible)
  if (password) {
    const valid = await verifySecret(password, user.password_hash);
    if (!valid) {
      const attempts = (user.login_attempts || 0) + 1;
      if (attempts >= 5) {
        const lockTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        db.prepare('UPDATE users SET login_attempts = ?, login_locked_until = ? WHERE id = ?').run(attempts, lockTime, user.id);
        handleFailedLogin(user.id, username, user.branch_id, req.ip);
        broadcastEvent({
          type: 'SUSPICIOUS_ACTIVITY',
          branchId: user.branch_id || 'branch_addis',
          targetRole: ['admin', 'owner'],
          payload: {
            userId: user.id,
            username: user.username,
            attempts: 5,
            message: `Account "${user.username}" locked for 15 minutes due to 5 consecutive failed password attempts.`
          }
        });
        return res.status(429).json({ error: 'Account locked due to 5 failed password attempts. Try again in 15 minutes.' });
      }

      db.prepare('UPDATE users SET login_attempts = ? WHERE id = ?').run(attempts, user.id);
      handleFailedLogin(user.id, username, user.branch_id, req.ip);
      return res.status(401).json({
        error: `Invalid username or password. ${5 - attempts} attempt(s) remaining before temporary lockout.`
      });
    }

    // Password valid — reset attempts counter and lockout
    db.prepare('UPDATE users SET login_attempts = 0, login_locked_until = NULL WHERE id = ?').run(user.id);
  } else if (pin) {
    // Check if account PIN is currently locked
    if (user.pin_locked_until) {
      const lockExpiry = new Date(user.pin_locked_until);
      if (lockExpiry > new Date()) {
        const remainingMinutes = Math.ceil((lockExpiry.getTime() - Date.now()) / 60000);
        return res.status(429).json({
          error: `PIN login locked due to excessive failed attempts. Try again in ${remainingMinutes} minute(s).`
        });
      }
    }

    if (!user.pin_hash) {
      handleFailedLogin(user.id, username, user.branch_id, req.ip);
      return res.status(401).json({ error: 'Invalid PIN.' });
    }
    const valid = await verifySecret(pin, user.pin_hash);
    if (!valid) {
      const attempts = (user.pin_attempts || 0) + 1;
      if (attempts >= 5) {
        const lockTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        db.prepare('UPDATE users SET pin_attempts = ?, pin_locked_until = ? WHERE id = ?').run(attempts, lockTime, user.id);
        handleFailedLogin(user.id, username, user.branch_id, req.ip);
        broadcastEvent({
          type: 'SUSPICIOUS_ACTIVITY',
          branchId: user.branch_id || 'branch_addis',
          targetRole: ['admin', 'owner'],
          payload: {
            userId: user.id,
            username: user.username,
            attempts: 5,
            message: `Account "${user.username}" PIN locked for 15 minutes due to 5 consecutive failed PIN attempts.`
          }
        });
        return res.status(429).json({ error: 'PIN login locked due to 5 failed attempts. Locked for 15 minutes.' });
      }

      db.prepare('UPDATE users SET pin_attempts = ? WHERE id = ?').run(attempts, user.id);
      handleFailedLogin(user.id, username, user.branch_id, req.ip);
      return res.status(401).json({
        error: `Invalid PIN. ${5 - attempts} attempt(s) remaining before 15-minute lockout.`
      });
    }

    // PIN valid — reset attempts counter and lockout
    db.prepare('UPDATE users SET pin_attempts = 0, pin_locked_until = NULL WHERE id = ?').run(user.id);
  } else {
    return res.status(400).json({ error: 'Password or PIN required.' });
  }

  if (user.status === 'PENDING_APPROVAL') {
    return res.status(403).json({ error: 'Account registration is pending Administrator approval.' });
  }
  if (user.status !== 'ACTIVE') {
    return res.status(403).json({ error: `Account is ${user.status}. Contact administrator.` });
  }

  // 2h Access Token (shortened from 7d for high restaurant security)
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      branch_id: user.branch_id,
      full_name: user.full_name
    },
    CONFIG.JWT_SECRET as string,
    { expiresIn: '2h' }
  );

  // 7d Refresh Token
  const refreshToken = jwt.sign(
    {
      id: user.id,
      token_type: 'refresh'
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
    refreshToken,
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

// 2. Token Refresh
authRouter.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, CONFIG.JWT_SECRET) as any;
    if (decoded.token_type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token type' });
    }

    const user = db.prepare('SELECT id, username, role, branch_id, full_name, status FROM users WHERE id = ? AND deleted_at IS NULL').get(decoded.id) as any;
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'User is inactive or no longer exists' });
    }

    const newAccessToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        branch_id: user.branch_id,
        full_name: user.full_name
      },
      CONFIG.JWT_SECRET as string,
      { expiresIn: '2h' }
    );

    res.json({ token: newAccessToken });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// 3. User Logout (Revoke Token)
authRouter.post('/logout', authenticate, (req: AuthenticatedRequest, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    blacklistToken(token);
  }

  logAudit({
    branchId: req.user!.branch_id,
    userId: req.user!.id,
    action: 'USER_LOGOUT',
    entityType: 'USER',
    entityId: req.user!.id,
    details: { username: req.user!.username }
  });

  res.json({ message: 'Logged out successfully' });
});

// 4. User Self-Registration
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

// 5. Current User Profile
authRouter.get('/me', authenticate, (req: AuthenticatedRequest, res) => {
  const user = db.prepare('SELECT id, full_name, username, phone, employee_id, role, branch_id, profile_photo, status FROM users WHERE id = ?').get(req.user!.id);
  const permissions = db.prepare('SELECT permission, is_granted FROM user_permissions WHERE user_id = ?').all(req.user!.id);
  res.json({ user, permissions });
});

// 6. Verify PIN with Throttling & 15-Minute Lockout
authRouter.post('/verify-pin', authenticate, validate(verifyPinSchema), async (req: AuthenticatedRequest, res) => {
  const { pin, userId } = req.body;

  const targetUserId = userId || req.user!.id;
  const targetUser = db.prepare('SELECT pin_hash, role, full_name, pin_attempts, pin_locked_until FROM users WHERE id = ?').get(targetUserId) as any;

  if (!targetUser || !targetUser.pin_hash) {
    return res.status(400).json({ error: 'User does not have a configured authorization PIN' });
  }

  // Check if account PIN is currently locked
  if (targetUser.pin_locked_until) {
    const lockExpiry = new Date(targetUser.pin_locked_until);
    if (lockExpiry > new Date()) {
      const remainingMinutes = Math.ceil((lockExpiry.getTime() - Date.now()) / 60000);
      return res.status(429).json({
        error: `PIN locked due to excessive failed attempts. Try again in ${remainingMinutes} minute(s).`
      });
    }
  }

  const valid = await verifySecret(pin, targetUser.pin_hash);
  if (!valid) {
    const attempts = (targetUser.pin_attempts || 0) + 1;
    if (attempts >= 5) {
      const lockTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      db.prepare('UPDATE users SET pin_attempts = ?, pin_locked_until = ? WHERE id = ?').run(attempts, lockTime, targetUserId);

      logAudit({
        branchId: req.user!.branch_id,
        userId: req.user!.id,
        action: 'PIN_LOCKED',
        entityType: 'USER',
        entityId: targetUserId,
        details: { targetName: targetUser.full_name, attempts: 5 }
      });

      return res.status(429).json({ error: 'PIN locked due to 5 failed attempts. Locked for 15 minutes.' });
    }

    db.prepare('UPDATE users SET pin_attempts = ? WHERE id = ?').run(attempts, targetUserId);
    return res.status(401).json({
      error: `Invalid authorization PIN. ${5 - attempts} attempt(s) remaining before 15-min lockout.`
    });
  }

  // Valid PIN: reset attempts counter
  db.prepare('UPDATE users SET pin_attempts = 0, pin_locked_until = NULL WHERE id = ?').run(targetUserId);

  res.json({ verified: true, authorizedBy: targetUser.full_name, role: targetUser.role });
});

// 7. Request Password Reset (Forgot Password)
authRouter.post('/forgot-password', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const user = db.prepare('SELECT id, username, branch_id FROM users WHERE username = ? AND deleted_at IS NULL').get(username) as any;

  if (user) {
    const resetToken = uuidv4();
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    db.prepare('UPDATE users SET reset_token = ?, reset_expiry = ? WHERE id = ?').run(resetToken, resetExpiry, user.id);

    broadcastEvent({
      type: 'PASSWORD_RESET_REQUEST',
      branchId: user.branch_id,
      targetRole: ['admin', 'owner'],
      payload: {
        userId: user.id,
        username: user.username,
        resetToken,
        requestedAt: new Date().toISOString()
      }
    });

    logAudit({
      branchId: user.branch_id,
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'USER',
      entityId: user.id,
      details: { username: user.username }
    });
  }

  // Consistent response to prevent user enumeration
  res.json({
    message: 'If the account exists, a password reset authorization link/code has been generated and sent to management.'
  });
});

// 8. Confirm Password Reset
authRouter.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Valid reset token and new password (min 6 characters) are required' });
  }

  const user = db.prepare(`
    SELECT id, username, branch_id FROM users
    WHERE reset_token = ? AND reset_expiry > CURRENT_TIMESTAMP AND deleted_at IS NULL
  `).get(token) as any;

  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired password reset token' });
  }

  const newHash = await hashSecret(newPassword);

  db.prepare(`
    UPDATE users
    SET password_hash = ?, reset_token = NULL, reset_expiry = NULL, pin_attempts = 0, pin_locked_until = NULL
    WHERE id = ?
  `).run(newHash, user.id);

  logAudit({
    branchId: user.branch_id,
    userId: user.id,
    action: 'PASSWORD_RESET_SUCCESS',
    entityType: 'USER',
    entityId: user.id,
    details: { username: user.username }
  });

  res.json({ message: 'Password updated successfully. You may now log in with your new credentials.' });
});

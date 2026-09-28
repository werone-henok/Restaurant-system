import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/schema.js';
import { CONFIG } from '../config/env.js';
import { authenticate, blacklistToken, authorizeRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { broadcastEvent } from '../services/websocket.js';
import { notifyRoles } from '../services/notificationService.js';
import { hashSecret, verifySecret } from '../utils/security.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema, verifyPinSchema } from '../schemas/api.schemas.js';
export const authRouter = Router();
// Helper to log failed login and check for brute-force attacks
function handleFailedLogin(userId, username, branchId, reqIp) {
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
    `).get(userId);
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
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND deleted_at IS NULL').get(username);
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
    }
    else if (pin) {
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
    }
    else {
        return res.status(400).json({ error: 'Password or PIN required.' });
    }
    if (user.status === 'PENDING_APPROVAL') {
        return res.status(403).json({ error: 'Account registration is pending Administrator approval.' });
    }
    if (user.status !== 'ACTIVE') {
        return res.status(403).json({ error: `Account is ${user.status}. Contact administrator.` });
    }
    // 2h Access Token (shortened from 7d for high restaurant security)
    const token = jwt.sign({
        id: user.id,
        username: user.username,
        role: user.role,
        branch_id: user.branch_id,
        full_name: user.full_name
    }, CONFIG.JWT_SECRET, { expiresIn: '2h' });
    // 7d Refresh Token
    const refreshToken = jwt.sign({
        id: user.id,
        token_type: 'refresh'
    }, CONFIG.JWT_SECRET, { expiresIn: '7d' });
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
        const decoded = jwt.verify(refreshToken, CONFIG.JWT_SECRET);
        if (decoded.token_type !== 'refresh') {
            return res.status(401).json({ error: 'Invalid refresh token type' });
        }
        const user = db.prepare('SELECT id, username, role, branch_id, full_name, status FROM users WHERE id = ? AND deleted_at IS NULL').get(decoded.id);
        if (!user || user.status !== 'ACTIVE') {
            return res.status(401).json({ error: 'User is inactive or no longer exists' });
        }
        const newAccessToken = jwt.sign({
            id: user.id,
            username: user.username,
            role: user.role,
            branch_id: user.branch_id,
            full_name: user.full_name
        }, CONFIG.JWT_SECRET, { expiresIn: '2h' });
        res.json({ token: newAccessToken });
    }
    catch {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
});
// 3. User Logout (Revoke Token)
authRouter.post('/logout', authenticate, (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        blacklistToken(token);
    }
    logAudit({
        branchId: req.user.branch_id,
        userId: req.user.id,
        action: 'USER_LOGOUT',
        entityType: 'USER',
        entityId: req.user.id,
        details: { username: req.user.username }
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
authRouter.get('/me', authenticate, (req, res) => {
    const user = db.prepare('SELECT id, full_name, username, phone, employee_id, role, branch_id, profile_photo, status FROM users WHERE id = ?').get(req.user.id);
    const permissions = db.prepare('SELECT permission, is_granted FROM user_permissions WHERE user_id = ?').all(req.user.id);
    res.json({ user, permissions });
});
// 6. Verify PIN with Throttling & 15-Minute Lockout
authRouter.post('/verify-pin', authenticate, validate(verifyPinSchema), async (req, res) => {
    const { pin, userId } = req.body;
    const targetUserId = userId || req.user.id;
    const targetUser = db.prepare('SELECT pin_hash, role, full_name, pin_attempts, pin_locked_until FROM users WHERE id = ?').get(targetUserId);
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
                branchId: req.user.branch_id,
                userId: req.user.id,
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
// 7. Request Password Reset (Forgot Password) -> Sent to Admin/Owner for strict approval
authRouter.post('/forgot-password', (req, res) => {
    const { username, contact, desired_password, reason } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Username or phone is required' });
    }
    const user = db.prepare('SELECT id, username, full_name, role, branch_id, phone FROM users WHERE (username = ? OR phone = ?) AND deleted_at IS NULL').get(username, username);
    if (user) {
        const reqId = `uar_${uuidv4().substring(0, 8)}`;
        const branchId = user.branch_id || 'branch_addis';
        db.prepare(`
      INSERT INTO user_account_requests (
        id, branch_id, user_id, username, full_name, role, request_type, requested_changes, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'FORGOT_PASSWORD', ?, 'PENDING')
    `).run(reqId, branchId, user.id, user.username, user.full_name, user.role, JSON.stringify({
            desired_password: desired_password || null,
            contact: contact || user.phone || null,
            reason: reason || 'የይለፍ ቃል ረሳሁ (Forgot Password)'
        }));
        notifyRoles({
            branchId,
            targetRoles: ['admin', 'owner'],
            title: '🔐 የይለፍ ቃል መቀየር ጥያቄ (Password Reset Request)',
            titleAmharic: '🔐 የይለፍ ቃል መቀየር ጥያቄ ደርሷል',
            message: `Staff member @${user.username} (${user.full_name}, ${user.role}) has requested a password reset. Requires Admin/Owner approval.`,
            type: 'USER_PENDING',
            linkRef: reqId
        });
        broadcastEvent({
            type: 'USER_ACCOUNT_REQUEST_NEW',
            branchId,
            targetRole: ['admin', 'owner'],
            payload: {
                requestId: reqId,
                userId: user.id,
                username: user.username,
                fullName: user.full_name,
                role: user.role,
                requestType: 'FORGOT_PASSWORD',
                requestedAt: new Date().toISOString()
            }
        });
        logAudit({
            branchId,
            userId: user.id,
            action: 'PASSWORD_RESET_REQUESTED',
            entityType: 'USER',
            entityId: user.id,
            details: { username: user.username, requestId: reqId }
        });
    }
    res.json({
        success: true,
        message: 'የይለፍ ቃል መቀየር ጥያቄዎ ለአስተዳዳሪው/ለባለቤቱ ተልኳል። ሲፈቀድ ማሳወቂያ ይደርሳችኋል። (Your password reset request has been submitted for Admin/Owner approval).'
    });
});
// 8. Submit Profile / Password Change Request (Authenticated User -> Strict Admin/Owner Approval)
authRouter.post('/profile-change-request', authenticate, (req, res) => {
    const { new_full_name, new_phone, new_password, reason } = req.body;
    const user = req.user;
    const branchId = user.branch_id || 'branch_addis';
    if (!new_full_name && !new_phone && !new_password) {
        return res.status(400).json({ error: 'At least one field (full name, phone, or new password) must be provided' });
    }
    if (new_password && new_password.trim().length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    const reqType = new_password && new_full_name
        ? 'PROFILE_AND_PASSWORD'
        : new_password
            ? 'PASSWORD_CHANGE'
            : 'PROFILE_UPDATE';
    const reqId = `uar_${uuidv4().substring(0, 8)}`;
    db.prepare(`
    INSERT INTO user_account_requests (
      id, branch_id, user_id, username, full_name, role, request_type, requested_changes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
  `).run(reqId, branchId, user.id, user.username, user.full_name, user.role, reqType, JSON.stringify({
        new_full_name: new_full_name?.trim() || null,
        new_phone: new_phone?.trim() || null,
        new_password: new_password?.trim() || null,
        reason: reason?.trim() || 'የመገለጫ/የይለፍ ቃል ማስተካከያ'
    }));
    notifyRoles({
        branchId,
        targetRoles: ['admin', 'owner'],
        title: '👤 የመገለጫ/የይለፍ ቃል ለውጥ ጥያቄ (Account Change Request)',
        titleAmharic: '👤 የመገለጫ/የይለፍ ቃል ለውጥ ጥያቄ',
        message: `${user.full_name} (@${user.username}) submitted an account change request (${reqType}). Requires approval.`,
        type: 'USER_PENDING',
        linkRef: reqId
    });
    broadcastEvent({
        type: 'USER_ACCOUNT_REQUEST_NEW',
        branchId,
        targetRole: ['admin', 'owner'],
        payload: {
            requestId: reqId,
            userId: user.id,
            username: user.username,
            fullName: user.full_name,
            role: user.role,
            requestType: reqType,
            requestedAt: new Date().toISOString()
        }
    });
    logAudit({
        branchId,
        userId: user.id,
        action: 'USER_ACCOUNT_REQUEST_SUBMITTED',
        entityType: 'USER',
        entityId: user.id,
        details: { username: user.username, requestType: reqType, requestId: reqId }
    });
    res.json({
        success: true,
        message: 'ጥያቄዎ ለአስተዳዳሪው/ለባለቤቱ ተልኳል፤ ጥብቅ ማረጋገጫ ከተደረገ በኋላ ተግባራዊ ይሆናል። (Your request has been submitted for Admin/Owner approval).'
    });
});
// 9. Get current user's submitted requests
authRouter.get('/my-account-requests', authenticate, (req, res) => {
    const requests = db.prepare(`
    SELECT * FROM user_account_requests
    WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 20
  `).all(req.user.id);
    res.json(requests);
});
// 10. List all account requests for Admin & Owner
authRouter.get('/admin/account-requests', authenticate, authorizeRole(['admin', 'owner']), (req, res) => {
    const status = req.query.status;
    let query = `
    SELECT r.*, u.profile_photo, u.employee_id, u.phone as current_phone
    FROM user_account_requests r
    LEFT JOIN users u ON r.user_id = u.id
  `;
    const params = [];
    if (status && status !== 'ALL') {
        query += ` WHERE r.status = ?`;
        params.push(status);
    }
    query += ` ORDER BY CASE r.status WHEN 'PENDING' THEN 1 ELSE 2 END, r.created_at DESC LIMIT 100`;
    const rows = db.prepare(query).all(...params);
    res.json(rows);
});
// 11. Approve Account / Password Request (Admin & Owner ONLY)
authRouter.patch('/admin/account-requests/:id/approve', authenticate, authorizeRole(['admin', 'owner']), async (req, res) => {
    const { id } = req.params;
    const { admin_notes, admin_password_override } = req.body;
    const item = db.prepare('SELECT * FROM user_account_requests WHERE id = ?').get(id);
    if (!item)
        return res.status(404).json({ error: 'Request not found' });
    if (item.status !== 'PENDING') {
        return res.status(400).json({ error: `Request is already ${item.status}` });
    }
    let changes = {};
    try {
        changes = JSON.parse(item.requested_changes);
    }
    catch (_) { }
    const targetUserId = item.user_id;
    const finalPassword = admin_password_override || changes.new_password || changes.desired_password;
    // 1. Update password if present
    if (finalPassword) {
        const newHash = await hashSecret(finalPassword);
        db.prepare(`
      UPDATE users
      SET password_hash = ?,
          login_attempts = 0,
          login_locked_until = NULL,
          pin_attempts = 0,
          pin_locked_until = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newHash, targetUserId);
    }
    // 2. Update profile fields if present
    if (changes.new_full_name) {
        db.prepare('UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(changes.new_full_name, targetUserId);
    }
    if (changes.new_phone) {
        db.prepare('UPDATE users SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(changes.new_phone, targetUserId);
    }
    // 3. Mark request as APPROVED
    db.prepare(`
    UPDATE user_account_requests
    SET status = 'APPROVED',
        reviewed_by_id = ?,
        reviewed_by_name = ?,
        admin_notes = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.user.id, req.user.full_name, admin_notes || 'Approved by management', id);
    logAudit({
        branchId: item.branch_id,
        userId: req.user.id,
        action: 'USER_ACCOUNT_REQUEST_APPROVED',
        entityType: 'USER',
        entityId: targetUserId,
        details: { requestId: id, targetUsername: item.username, type: item.request_type, passwordChanged: !!finalPassword }
    });
    broadcastEvent({
        type: 'USER_ACCOUNT_REQUEST_RESOLVED',
        branchId: item.branch_id,
        payload: { requestId: id, status: 'APPROVED', username: item.username, targetUserId }
    });
    res.json({
        success: true,
        message: `ጥያቄው ጸድቋል! የተጠቃሚው መረጃ/የይለፍ ቃል ተቀይሯል። (Request approved successfully).`
    });
});
// 12. Reject Account / Password Request (Admin & Owner ONLY)
authRouter.patch('/admin/account-requests/:id/reject', authenticate, authorizeRole(['admin', 'owner']), (req, res) => {
    const { id } = req.params;
    const { admin_notes } = req.body;
    const item = db.prepare('SELECT * FROM user_account_requests WHERE id = ?').get(id);
    if (!item)
        return res.status(404).json({ error: 'Request not found' });
    db.prepare(`
    UPDATE user_account_requests
    SET status = 'REJECTED',
        reviewed_by_id = ?,
        reviewed_by_name = ?,
        admin_notes = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.user.id, req.user.full_name, admin_notes || 'Rejected by management', id);
    logAudit({
        branchId: item.branch_id,
        userId: req.user.id,
        action: 'USER_ACCOUNT_REQUEST_REJECTED',
        entityType: 'USER',
        entityId: item.user_id,
        details: { requestId: id, targetUsername: item.username, type: item.request_type }
    });
    broadcastEvent({
        type: 'USER_ACCOUNT_REQUEST_RESOLVED',
        branchId: item.branch_id,
        payload: { requestId: id, status: 'REJECTED', username: item.username }
    });
    res.json({ success: true, message: 'ጥያቄው ውድቅ ተደርጓል (Request rejected).' });
});
// 13. Direct Admin Reset Password (One-click from Staff Table)
authRouter.post('/admin/direct-reset-password', authenticate, authorizeRole(['admin', 'owner']), async (req, res) => {
    const { user_id, new_password } = req.body;
    if (!user_id || !new_password || new_password.trim().length < 6) {
        return res.status(400).json({ error: 'User ID and valid new password (min 6 characters) are required' });
    }
    const target = db.prepare('SELECT id, username, full_name, branch_id FROM users WHERE id = ? AND deleted_at IS NULL').get(user_id);
    if (!target)
        return res.status(404).json({ error: 'User not found' });
    const newHash = await hashSecret(new_password.trim());
    db.prepare(`
    UPDATE users
    SET password_hash = ?,
        login_attempts = 0,
        login_locked_until = NULL,
        pin_attempts = 0,
        pin_locked_until = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newHash, user_id);
    logAudit({
        branchId: target.branch_id || 'branch_addis',
        userId: req.user.id,
        action: 'ADMIN_DIRECT_PASSWORD_RESET',
        entityType: 'USER',
        entityId: user_id,
        details: { targetUsername: target.username }
    });
    res.json({ success: true, message: `ለ @${target.username} አዲስ የይለፍ ቃል ተቀናብሯል! (Password updated successfully).` });
});
// 14. Confirm Password Reset via token
authRouter.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Valid reset token and new password (min 6 characters) are required' });
    }
    const user = db.prepare(`
    SELECT id, username, branch_id FROM users
    WHERE reset_token = ? AND reset_expiry > CURRENT_TIMESTAMP AND deleted_at IS NULL
  `).get(token);
    if (!user) {
        return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }
    const newHash = await hashSecret(newPassword);
    db.prepare(`
    UPDATE users
    SET password_hash = ?, reset_token = NULL, reset_expiry = NULL, pin_attempts = 0, pin_locked_until = NULL, login_attempts = 0, login_locked_until = NULL
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

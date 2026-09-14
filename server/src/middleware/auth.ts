import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG, type UserRole, type PermissionKey } from '../config/env.js';
import { db } from '../database/schema.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: UserRole;
    branch_id: string;
    full_name: string;
    status: string;
  };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing or malformed token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as any;

    // Verify user is still active in database
    const user = db.prepare('SELECT id, username, role, branch_id, full_name, status FROM users WHERE id = ?').get(decoded.id) as any;
    if (!user) {
      return res.status(401).json({ error: 'User account no longer exists.' });
    }
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: `Account is ${user.status.toLowerCase()}. Access denied.` });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export function authorizeRole(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // Owner always has omniscient access
    if (req.user.role === 'owner') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Requires one of roles: [${roles.join(', ')}]` });
    }

    next();
  };
}

export function requirePermission(permission: PermissionKey) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (req.user.role === 'owner') {
      return next();
    }

    // Check custom overrides first
    const override = db.prepare('SELECT is_granted FROM user_permissions WHERE user_id = ? AND permission = ?').get(req.user.id, permission) as any;
    if (override !== undefined) {
      if (override.is_granted === 1) return next();
      return res.status(403).json({ error: `Explicitly revoked permission: ${permission}` });
    }

    // Default permission roles
    const roleDefaultPermissions: Record<string, string[]> = {
      admin: [...CONFIG.PERMISSIONS],
      cashier: ['approve_discounts', 'modify_confirmed_orders', 'view_sales'],
      chef: ['manage_recipes', 'manage_inventory'],
      barista: ['manage_recipes'],
      waiter: [],
      storekeeper: ['manage_inventory', 'adjust_inventory', 'manage_suppliers']
    };

    const allowed = roleDefaultPermissions[req.user.role]?.includes(permission);
    if (!allowed) {
      return res.status(403).json({ error: `Missing required permission: ${permission}` });
    }

    next();
  };
}

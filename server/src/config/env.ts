import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  JWT_SECRET: process.env.JWT_SECRET || 'gourmet-os-super-secret-key-production-mvr-2026',
  JWT_EXPIRES_IN: '7d',
  DB_PATH: process.env.DB_PATH || path.resolve(__dirname, '../../restaurant.db'),
  UPLOAD_DIR: path.resolve(__dirname, '../../uploads'),
  DEFAULT_CURRENCY: 'ETB',
  DEFAULT_TAX_RATE: 0.15, // 15% VAT standard Ethiopian tax
  ROLES: ['owner', 'admin', 'cashier', 'chef', 'barista', 'waiter', 'storekeeper'] as const,
  PERMISSIONS: [
    'view_sales',
    'view_expenses',
    'create_expense',
    'edit_expense',
    'delete_expense',
    'manage_users',
    'approve_users',
    'manage_menu',
    'change_prices',
    'manage_inventory',
    'adjust_inventory',
    'manage_suppliers',
    'manage_recipes',
    'approve_discounts',
    'cancel_orders',
    'modify_confirmed_orders',
    'view_reports',
    'manage_branches',
    'manage_settings',
    'manage_branding'
  ] as const
};

export type UserRole = typeof CONFIG.ROLES[number];
export type PermissionKey = typeof CONFIG.PERMISSIONS[number];

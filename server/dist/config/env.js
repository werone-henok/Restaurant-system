import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is missing in production!');
    process.exit(1);
}
export const CONFIG = {
    PORT: parseInt(process.env.PORT || '4001', 10),
    JWT_SECRET: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'gourmet-os-dev-secret-change-in-production'),
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    CORS_ORIGINS: [
        'http://localhost:5180',
        'http://127.0.0.1:5180',
        'http://localhost:4001',
        'http://localhost:5173',
        'http://localhost:4000',
        'http://127.0.0.1:5173',
        'https://localhost',
        'http://localhost',
        'capacitor://localhost',
        'ionic://localhost',
        ...(process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map(s => s.trim()) : [])
    ],
    DB_PATH: process.env.DB_PATH || path.resolve(__dirname, '../../restaurant.db'),
    UPLOAD_DIR: process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads'),
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_KEY: process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    SUPABASE_BUCKET: process.env.SUPABASE_BUCKET || 'restaurant-backups',
    CLOUD_SYNC_INTERVAL_MS: parseInt(process.env.CLOUD_SYNC_INTERVAL_MS || '300000', 10),
    DEFAULT_CURRENCY: 'ETB',
    DEFAULT_TAX_RATE: 0.15, // 15% VAT standard Ethiopian tax
    ROLES: ['owner', 'admin', 'cashier', 'chef', 'barista', 'waiter', 'storekeeper'],
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
    ]
};

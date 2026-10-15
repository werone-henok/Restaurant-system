#!/usr/bin/env node

/**
 * ============================================================================
 * Official Restaurant Menu Seeder Script
 * Seeds all 11 official categories and 96 menu items with images, prices & translations
 * ============================================================================
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../restaurant.db');
console.log(`[Official Menu CLI] Connecting to database at: ${dbPath}`);

const db = new Database(dbPath);

// Import official categories and menu items
import('../src/database/officialMenu.js').then(({ seedOfficialMenu, OFFICIAL_CATEGORIES, OFFICIAL_MENU_ITEMS }) => {
  console.log(`[Official Menu CLI] Starting seed of ${OFFICIAL_CATEGORIES.length} categories and ${OFFICIAL_MENU_ITEMS.length} items...`);
  seedOfficialMenu(true);
  console.log('[Official Menu CLI] ✓ Seeding complete!');
  process.exit(0);
}).catch(err => {
  console.error('[Official Menu CLI] ✗ Error:', err);
  process.exit(1);
});

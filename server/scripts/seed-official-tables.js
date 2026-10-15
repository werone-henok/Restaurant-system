#!/usr/bin/env node

/**
 * ============================================================================
 * Official Restaurant Tables Seeder Script
 * Seeds all 6 sections and 51 tables into SQLite
 * ============================================================================
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../restaurant.db');
console.log(`[Official Tables CLI] Connecting to database at: ${dbPath}`);

import('../src/database/officialTables.js').then(({ seedOfficialTables, OFFICIAL_TABLES, OFFICIAL_SECTIONS }) => {
  console.log(`[Official Tables CLI] Starting seed of ${OFFICIAL_TABLES.length} tables across ${OFFICIAL_SECTIONS.length} sections...`);
  seedOfficialTables(undefined, true);
  console.log('[Official Tables CLI] ✓ Seeding complete!');
  process.exit(0);
}).catch(err => {
  console.error('[Official Tables CLI] ✗ Error:', err);
  process.exit(1);
});

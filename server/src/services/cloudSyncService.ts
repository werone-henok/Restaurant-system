import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CONFIG } from '../config/env.js';
import { getNativeDb } from '../database/connection.js';

interface SyncStatus {
  enabled: boolean;
  configured: boolean;
  bucket: string;
  lastSync: string | null;
  lastStatus: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';
  lastReason: string | null;
  lastError: string | null;
  bytesSynced: number | null;
}

const syncStatus: SyncStatus = {
  enabled: Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY),
  configured: Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY),
  bucket: CONFIG.SUPABASE_BUCKET,
  lastSync: null,
  lastStatus: 'IDLE',
  lastReason: null,
  lastError: null,
  bytesSynced: null
};

let supabase: SupabaseClient | null = null;
let isSyncing = false;
let debouncedTimer: NodeJS.Timeout | null = null;
let autoSyncInterval: NodeJS.Timeout | null = null;

function normalizeSupabaseUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim();
  if (!url) return '';

  // If user pasted dashboard URL: https://supabase.com/dashboard/project/<ref>...
  const dashboardMatch = url.match(/supabase\.com\/dashboard\/project\/([a-zA-Z0-9_-]+)/);
  if (dashboardMatch && dashboardMatch[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  // Strip trailing slashes
  url = url.replace(/\/+$/, '');

  // If user forgot https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  return url;
}

function getSupabase(): SupabaseClient | null {
  if (!syncStatus.configured) return null;
  if (!supabase) {
    const normalizedUrl = normalizeSupabaseUrl(CONFIG.SUPABASE_URL);
    supabase = createClient(normalizedUrl, CONFIG.SUPABASE_KEY.trim(), {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return supabase;
}

/**
 * Downloads the latest database file from Supabase Storage on server startup.
 * Called BEFORE opening SQLite with getDatabase().
 */
export async function restoreLatestFromCloud(): Promise<boolean> {
  const client = getSupabase();
  if (!client) {
    console.log('[CloudSync] Cloud credentials not configured. Using local filesystem database.');
    return false;
  }

  try {
    console.log(`[CloudSync] Checking remote storage for latest database in bucket: "${CONFIG.SUPABASE_BUCKET}"...`);

    const { data, error } = await client.storage
      .from(CONFIG.SUPABASE_BUCKET)
      .download('restaurant.db');

    if (error) {
      if ((error as any).status === 404 || error.message?.includes('not found') || error.message?.includes('Object not found')) {
        console.log('[CloudSync] No existing database in cloud bucket yet. Will initialize fresh database and sync on first write.');
        return false;
      }
      console.warn('[CloudSync] Notice while checking remote backup:', error.message);
      return false;
    }

    if (!data) {
      console.log('[CloudSync] Empty response from cloud storage.');
      return false;
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 100) {
      console.warn('[CloudSync] Remote database file appears corrupt or empty (<100 bytes). Skipping restore.');
      return false;
    }

    const SQLITE_HEADER = 'SQLite format 3\0';
    const fileHeader = buffer.subarray(0, 16).toString('utf-8');
    if (fileHeader !== SQLITE_HEADER) {
      console.warn('[CloudSync] ⚠️ Remote file in bucket is NOT a valid SQLite database (header mismatch).');
      console.warn(`[CloudSync] Preview of remote content: "${buffer.subarray(0, 80).toString('utf-8').replace(/[^\x20-\x7E]/g, '.')}"`);
      console.warn('[CloudSync] Skipping restore of invalid file. Initializing healthy database and will overwrite with clean backup.');
      return false;
    }

    const dir = path.dirname(CONFIG.DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Clean up any stale WAL or SHM files from previous container crashes before writing base db
    try {
      if (fs.existsSync(`${CONFIG.DB_PATH}-wal`)) fs.unlinkSync(`${CONFIG.DB_PATH}-wal`);
      if (fs.existsSync(`${CONFIG.DB_PATH}-shm`)) fs.unlinkSync(`${CONFIG.DB_PATH}-shm`);
    } catch (_) {}

    fs.writeFileSync(CONFIG.DB_PATH, buffer);
    syncStatus.lastSync = new Date().toISOString();
    syncStatus.lastStatus = 'SUCCESS';
    syncStatus.lastReason = 'startup_restore';
    syncStatus.bytesSynced = buffer.length;

    console.log(`[CloudSync] ✅ Successfully restored database from cloud storage! (${(buffer.length / 1024).toFixed(1)} KB)`);
    return true;
  } catch (err: any) {
    console.error('[CloudSync] Failed to restore database from cloud:', err.message || err);
    syncStatus.lastError = err.message || String(err);
    return false;
  }
}

/**
 * Creates an atomic non-blocking backup of SQLite and uploads it to Supabase Storage.
 */
export async function syncDatabaseToCloud(reason: string = 'manual'): Promise<{ success: boolean; message: string }> {
  const client = getSupabase();
  if (!client) {
    return { success: false, message: 'Cloud sync not configured (SUPABASE_URL and SUPABASE_KEY missing)' };
  }

  if (isSyncing) {
    return { success: false, message: 'Sync already in progress' };
  }

  isSyncing = true;
  syncStatus.lastStatus = 'SYNCING';
  syncStatus.lastReason = reason;

  const tempBackupPath = path.join(path.dirname(CONFIG.DB_PATH), `sync_temp_${Date.now()}.db`);

  try {
    const nativeDb = getNativeDb();

    // Use better-sqlite3 native non-blocking transactional backup
    await nativeDb.backup(tempBackupPath);

    if (!fs.existsSync(tempBackupPath)) {
      throw new Error('SQLite backup file was not created');
    }

    const fileBuffer = fs.readFileSync(tempBackupPath);
    if (fileBuffer.length === 0) {
      throw new Error('Created backup file was empty');
    }

    // 1. Upload primary snapshot (always replaced)
    const { error: primaryError } = await client.storage
      .from(CONFIG.SUPABASE_BUCKET)
      .upload('restaurant.db', fileBuffer, {
        upsert: true,
        contentType: 'application/x-sqlite3'
      });

    if (primaryError) {
      throw new Error(`Cloud upload failed: ${primaryError.message}`);
    }

    // 2. Upload a timestamped daily snapshot for disaster recovery (e.g., backups/backup_2026-09-23.db)
    const today = new Date().toISOString().split('T')[0];
    const dailyPath = `backups/backup_${today}.db`;
    await client.storage
      .from(CONFIG.SUPABASE_BUCKET)
      .upload(dailyPath, fileBuffer, {
        upsert: true,
        contentType: 'application/x-sqlite3'
      })
      .catch(err => {
        console.warn('[CloudSync] Daily snapshot warning (non-fatal):', err.message);
      });

    syncStatus.lastSync = new Date().toISOString();
    syncStatus.lastStatus = 'SUCCESS';
    syncStatus.lastError = null;
    syncStatus.bytesSynced = fileBuffer.length;

    console.log(`[CloudSync] ☁️ Database snapshot synced to cloud successfully (${reason}, ${(fileBuffer.length / 1024).toFixed(1)} KB)`);
    return { success: true, message: `Successfully synced ${(fileBuffer.length / 1024).toFixed(1)} KB to cloud` };
  } catch (err: any) {
    console.error('[CloudSync] ❌ Cloud backup failed:', err.message || err);
    syncStatus.lastStatus = 'ERROR';
    syncStatus.lastError = err.message || String(err);
    return { success: false, message: err.message || String(err) };
  } finally {
    isSyncing = false;
    // Clean up temporary snapshot file
    try {
      if (fs.existsSync(tempBackupPath)) {
        fs.unlinkSync(tempBackupPath);
      }
    } catch (_) {}
  }
}

/**
 * Request a debounced sync. Useful after heavy write operations.
 */
export function requestDebouncedSync(delayMs: number = 10000) {
  if (!syncStatus.configured) return;

  if (debouncedTimer) {
    clearTimeout(debouncedTimer);
  }

  debouncedTimer = setTimeout(() => {
    syncDatabaseToCloud('debounced_mutation').catch(() => {});
  }, delayMs);
}

/**
 * Initializes automatic background synchronization and shutdown hooks.
 */
export function initAutoSync() {
  if (!syncStatus.configured) {
    console.log('[CloudSync] Running without cloud sync (local storage only).');
    return;
  }

  console.log(`[CloudSync] Initializing auto-sync scheduler (Interval: ${CONFIG.CLOUD_SYNC_INTERVAL_MS / 1000}s)`);

  // Initial sync 30s after startup to ensure cloud has latest seed
  setTimeout(() => {
    syncDatabaseToCloud('startup_init').catch(() => {});
  }, 30000);

  // Periodic interval
  autoSyncInterval = setInterval(() => {
    syncDatabaseToCloud('periodic').catch(() => {});
  }, CONFIG.CLOUD_SYNC_INTERVAL_MS);

  // Graceful shutdown on Render container stop (SIGTERM) or Ctrl+C (SIGINT)
  const handleExit = async (signal: string) => {
    console.log(`[CloudSync] Received ${signal}. Flushing final database snapshot to cloud before exiting...`);
    if (autoSyncInterval) clearInterval(autoSyncInterval);
    if (debouncedTimer) clearTimeout(debouncedTimer);

    try {
      await syncDatabaseToCloud(`shutdown_${signal}`);
    } catch (e) {
      console.error('[CloudSync] Error during shutdown sync:', e);
    }
    process.exit(0);
  };

  process.once('SIGTERM', () => handleExit('SIGTERM'));
  process.once('SIGINT', () => handleExit('SIGINT'));
}

export function getSyncStatus(): SyncStatus {
  return {
    ...syncStatus,
    enabled: Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY),
    configured: Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY),
    bucket: CONFIG.SUPABASE_BUCKET
  };
}

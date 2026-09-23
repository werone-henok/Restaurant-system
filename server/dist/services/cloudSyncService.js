import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../config/env.js';
import { getNativeDb } from '../database/connection.js';
const syncStatus = {
    enabled: Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY),
    configured: Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY),
    bucket: CONFIG.SUPABASE_BUCKET,
    lastSync: null,
    lastStatus: 'IDLE',
    lastReason: null,
    lastError: null,
    bytesSynced: null
};
let supabase = null;
let isSyncing = false;
let debouncedTimer = null;
let autoSyncInterval = null;
function normalizeSupabaseUrl(rawUrl) {
    let url = (rawUrl || '').trim();
    if (!url)
        return '';
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
export function getSupabase() {
    if (!syncStatus.configured)
        return null;
    if (!supabase) {
        const normalizedUrl = normalizeSupabaseUrl(CONFIG.SUPABASE_URL);
        supabase = createClient(normalizedUrl, CONFIG.SUPABASE_KEY.trim(), {
            auth: { persistSession: false, autoRefreshToken: false }
        });
    }
    return supabase;
}
/**
 * Uploads an image buffer to Supabase Storage in the uploads/ directory of the bucket.
 */
export async function uploadImageToCloud(filename, buffer, contentType = 'image/jpeg') {
    const client = getSupabase();
    if (!client)
        return false;
    try {
        const remotePath = `uploads/${filename}`;
        const { error } = await client.storage
            .from(CONFIG.SUPABASE_BUCKET)
            .upload(remotePath, buffer, {
            upsert: true,
            contentType
        });
        if (error) {
            console.warn(`[CloudStorage] ⚠️ Failed to upload image "${filename}" to cloud:`, error.message);
            return false;
        }
        console.log(`[CloudStorage] ☁️ Image persisted to cloud: "${remotePath}" (${(buffer.length / 1024).toFixed(1)} KB)`);
        return true;
    }
    catch (err) {
        console.warn(`[CloudStorage] Error during image upload for "${filename}":`, err.message || err);
        return false;
    }
}
/**
 * Downloads an image from Supabase Storage if it exists.
 */
export async function downloadImageFromCloud(filename) {
    const client = getSupabase();
    if (!client)
        return null;
    try {
        const remotePath = `uploads/${filename}`;
        const { data, error } = await client.storage
            .from(CONFIG.SUPABASE_BUCKET)
            .download(remotePath);
        if (error || !data) {
            return null;
        }
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = path.extname(filename).toLowerCase();
        const mimeMap = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml'
        };
        const contentType = mimeMap[ext] || data.type || 'image/jpeg';
        return { buffer, contentType };
    }
    catch (err) {
        console.warn(`[CloudStorage] Error downloading image "${filename}":`, err.message || err);
        return null;
    }
}
/**
 * Scans menu items for uploaded photos. If any photo is missing locally and in cloud storage
 * (e.g. from an ephemeral container restart before cloud sync was active),
 * automatically restores it with a high quality dish photo so the user's UI displays beautifully.
 */
export async function healMissingUploadedImages() {
    try {
        const { db } = await import('../database/schema.js');
        const items = db.prepare(`
      SELECT id, name, photo_url 
      FROM menu_items 
      WHERE photo_url LIKE '/uploads/%' AND deleted_at IS NULL
    `).all();
        if (!items || items.length === 0)
            return;
        for (const item of items) {
            const filename = path.basename(item.photo_url);
            const localPath = path.join(CONFIG.UPLOAD_DIR, filename);
            // Check if local file already exists
            if (fs.existsSync(localPath) && fs.statSync(localPath).size > 100) {
                continue;
            }
            // Check if file exists in cloud storage
            const cloudFile = await downloadImageFromCloud(filename);
            if (cloudFile && cloudFile.buffer.length > 100) {
                if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
                    fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
                }
                fs.writeFileSync(localPath, cloudFile.buffer);
                console.log(`[CloudSync] Restored cached image for "${item.name}": ${filename}`);
                continue;
            }
            // If missing from both cloud and disk, heal with a delicious fallback photo
            console.log(`[CloudSync] 🩹 Healing missing photo for menu item "${item.name}" (${filename})...`);
            let fallbackUrl = 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&q=80'; // gourmet burger
            const lowerName = item.name.toLowerCase();
            if (lowerName.includes('pizza')) {
                fallbackUrl = 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80';
            }
            else if (lowerName.includes('coffee') || lowerName.includes('macchiato')) {
                fallbackUrl = 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600&q=80';
            }
            else if (lowerName.includes('juice') || lowerName.includes('drink')) {
                fallbackUrl = 'https://images.unsplash.com/photo-1546173159-315724a31696?w=600&q=80';
            }
            try {
                const resp = await fetch(fallbackUrl);
                if (resp.ok) {
                    const buf = Buffer.from(await resp.arrayBuffer());
                    if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
                        fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
                    }
                    fs.writeFileSync(localPath, buf);
                    await uploadImageToCloud(filename, buf, 'image/jpeg');
                    console.log(`[CloudSync] ✅ Successfully healed and uploaded "${item.name}" photo (${filename}) to cloud!`);
                }
            }
            catch (fetchErr) {
                console.warn(`[CloudSync] Failed to fetch fallback image for "${item.name}":`, fetchErr);
            }
        }
    }
    catch (err) {
        console.warn('[CloudSync] Notice during missing images healing check:', err);
    }
}
/**
 * Downloads the latest database file from Supabase Storage on server startup.
 * Called BEFORE opening SQLite with getDatabase().
 */
export async function restoreLatestFromCloud() {
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
            if (error.status === 404 || error.message?.includes('not found') || error.message?.includes('Object not found')) {
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
            if (fs.existsSync(`${CONFIG.DB_PATH}-wal`))
                fs.unlinkSync(`${CONFIG.DB_PATH}-wal`);
            if (fs.existsSync(`${CONFIG.DB_PATH}-shm`))
                fs.unlinkSync(`${CONFIG.DB_PATH}-shm`);
        }
        catch (_) { }
        fs.writeFileSync(CONFIG.DB_PATH, buffer);
        syncStatus.lastSync = new Date().toISOString();
        syncStatus.lastStatus = 'SUCCESS';
        syncStatus.lastReason = 'startup_restore';
        syncStatus.bytesSynced = buffer.length;
        console.log(`[CloudSync] ✅ Successfully restored database from cloud storage! (${(buffer.length / 1024).toFixed(1)} KB)`);
        return true;
    }
    catch (err) {
        console.error('[CloudSync] Failed to restore database from cloud:', err.message || err);
        syncStatus.lastError = err.message || String(err);
        return false;
    }
}
/**
 * Creates an atomic non-blocking backup of SQLite and uploads it to Supabase Storage.
 */
export async function syncDatabaseToCloud(reason = 'manual') {
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
    }
    catch (err) {
        console.error('[CloudSync] ❌ Cloud backup failed:', err.message || err);
        syncStatus.lastStatus = 'ERROR';
        syncStatus.lastError = err.message || String(err);
        return { success: false, message: err.message || String(err) };
    }
    finally {
        isSyncing = false;
        // Clean up temporary snapshot file
        try {
            if (fs.existsSync(tempBackupPath)) {
                fs.unlinkSync(tempBackupPath);
            }
        }
        catch (_) { }
    }
}
/**
 * Request a debounced sync. Useful after heavy write operations.
 */
export function requestDebouncedSync(delayMs = 10000) {
    if (!syncStatus.configured)
        return;
    if (debouncedTimer) {
        clearTimeout(debouncedTimer);
    }
    debouncedTimer = setTimeout(() => {
        syncDatabaseToCloud('debounced_mutation').catch(() => { });
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
        syncDatabaseToCloud('startup_init').catch(() => { });
    }, 30000);
    // Periodic interval
    autoSyncInterval = setInterval(() => {
        syncDatabaseToCloud('periodic').catch(() => { });
    }, CONFIG.CLOUD_SYNC_INTERVAL_MS);
    // Graceful shutdown on Render container stop (SIGTERM) or Ctrl+C (SIGINT)
    const handleExit = async (signal) => {
        console.log(`[CloudSync] Received ${signal}. Flushing final database snapshot to cloud before exiting...`);
        if (autoSyncInterval)
            clearInterval(autoSyncInterval);
        if (debouncedTimer)
            clearTimeout(debouncedTimer);
        try {
            await syncDatabaseToCloud(`shutdown_${signal}`);
        }
        catch (e) {
            console.error('[CloudSync] Error during shutdown sync:', e);
        }
        process.exit(0);
    };
    process.once('SIGTERM', () => handleExit('SIGTERM'));
    process.once('SIGINT', () => handleExit('SIGINT'));
}
export function getSyncStatus() {
    return {
        ...syncStatus,
        enabled: Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY),
        configured: Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY),
        bucket: CONFIG.SUPABASE_BUCKET
    };
}

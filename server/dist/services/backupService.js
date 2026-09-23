import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config/env.js';
const BACKUP_DIR = path.join(CONFIG.UPLOAD_DIR, 'backups');
export function performBackup() {
    try {
        if (!fs.existsSync(CONFIG.DB_PATH)) {
            return null;
        }
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
        const dateStr = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const backupFileName = `backup_${dateStr}.db`;
        const targetPath = path.join(BACKUP_DIR, backupFileName);
        fs.copyFileSync(CONFIG.DB_PATH, targetPath);
        // Prune: keep only last 30 backups
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
            .sort();
        if (files.length > 30) {
            const toDelete = files.slice(0, files.length - 30);
            toDelete.forEach(f => {
                try {
                    fs.unlinkSync(path.join(BACKUP_DIR, f));
                }
                catch (_) { }
            });
        }
        return targetPath;
    }
    catch (err) {
        console.error('Automated database backup failed:', err);
        return null;
    }
}
export function initBackupScheduler() {
    // Run an immediate check on startup
    performBackup();
    // Schedule daily backup check (every 24 hours)
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    setInterval(() => {
        performBackup();
    }, TWENTY_FOUR_HOURS);
}

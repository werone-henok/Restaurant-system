import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config/env.js';
let dbInstance = null;
function sanitizeParams(params) {
    return params.map(p => (p === undefined ? null : p));
}
export function getNativeDb() {
    if (!dbInstance) {
        const dir = path.dirname(CONFIG.DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        try {
            dbInstance = new Database(CONFIG.DB_PATH);
            dbInstance.pragma('journal_mode = WAL');
            dbInstance.pragma('foreign_keys = ON');
            dbInstance.pragma('synchronous = NORMAL');
        }
        catch (err) {
            if (err.code === 'SQLITE_NOTADB' || err.message?.includes('not a database')) {
                console.warn(`[Database] File at ${CONFIG.DB_PATH} is corrupted (SQLITE_NOTADB). Recreating fresh database.`);
                try {
                    if (fs.existsSync(CONFIG.DB_PATH))
                        fs.unlinkSync(CONFIG.DB_PATH);
                    if (fs.existsSync(`${CONFIG.DB_PATH}-wal`))
                        fs.unlinkSync(`${CONFIG.DB_PATH}-wal`);
                    if (fs.existsSync(`${CONFIG.DB_PATH}-shm`))
                        fs.unlinkSync(`${CONFIG.DB_PATH}-shm`);
                }
                catch (_) { }
                dbInstance = new Database(CONFIG.DB_PATH);
                dbInstance.pragma('journal_mode = WAL');
                dbInstance.pragma('foreign_keys = ON');
                dbInstance.pragma('synchronous = NORMAL');
            }
            else {
                throw err;
            }
        }
    }
    return dbInstance;
}
export async function getDatabase() {
    return getNativeDb();
}
export function saveDbToFile() {
    // No-op: better-sqlite3 writes directly to disk with WAL journaling
}
export const dbWrapper = {
    exec(sql) {
        return getNativeDb().exec(sql);
    },
    prepare(sql) {
        const stmt = getNativeDb().prepare(sql);
        return {
            run(...params) {
                return stmt.run(...sanitizeParams(params));
            },
            get(...params) {
                return stmt.get(...sanitizeParams(params));
            },
            all(...params) {
                return stmt.all(...sanitizeParams(params));
            }
        };
    },
    transaction(fn) {
        const nativeTx = getNativeDb().transaction(fn);
        return (...args) => nativeTx(...args);
    },
    pragma(sql) {
        return getNativeDb().pragma(sql);
    }
};

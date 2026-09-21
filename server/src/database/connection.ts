import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config/env.js';

let dbInstance: Database.Database | null = null;

function sanitizeParams(params: any[]) {
  return params.map(p => (p === undefined ? null : p));
}

export function getNativeDb(): Database.Database {
  if (!dbInstance) {
    const dir = path.dirname(CONFIG.DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    dbInstance = new Database(CONFIG.DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.pragma('synchronous = NORMAL');
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
  exec(sql: string) {
    return getNativeDb().exec(sql);
  },
  prepare(sql: string) {
    const stmt = getNativeDb().prepare(sql);
    return {
      run(...params: any[]) {
        return stmt.run(...sanitizeParams(params));
      },
      get(...params: any[]) {
        return stmt.get(...sanitizeParams(params));
      },
      all(...params: any[]) {
        return stmt.all(...sanitizeParams(params));
      }
    };
  },
  transaction(fn: (...args: any[]) => any) {
    const nativeTx = getNativeDb().transaction(fn);
    return (...args: any[]) => nativeTx(...args);
  },
  pragma(sql: string) {
    return getNativeDb().pragma(sql);
  }
};

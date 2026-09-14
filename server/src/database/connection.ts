import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config/env.js';

let rawDb: any = null;

export async function getDatabase() {
  if (rawDb) return dbWrapper;

  const SQL = await initSqlJs();
  if (fs.existsSync(CONFIG.DB_PATH)) {
    try {
      const filebuffer = fs.readFileSync(CONFIG.DB_PATH);
      rawDb = new SQL.Database(filebuffer);
    } catch (e) {
      rawDb = new SQL.Database();
    }
  } else {
    rawDb = new SQL.Database();
  }

  return dbWrapper;
}

export function saveDbToFile() {
  if (!rawDb) return;
  try {
    const data = rawDb.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(CONFIG.DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG.DB_PATH, buffer);
  } catch (e) {
    console.error('Error saving db to disk:', e);
  }
}

export const dbWrapper = {
  exec(sql: string) {
    rawDb.run(sql);
    saveDbToFile();
  },
  prepare(sql: string) {
    return {
      run(...params: any[]) {
        const flatParams = params.map(p => (p === undefined ? null : p));
        rawDb.run(sql, flatParams);
        saveDbToFile();
        return { changes: rawDb.getRowsModified() };
      },
      get(...params: any[]) {
        const flatParams = params.map(p => (p === undefined ? null : p));
        const stmt = rawDb.prepare(sql);
        try {
          if (flatParams.length > 0) {
            stmt.bind(flatParams);
          }
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        } finally {
          stmt.free();
        }
      },
      all(...params: any[]) {
        const flatParams = params.map(p => (p === undefined ? null : p));
        const stmt = rawDb.prepare(sql);
        const results: any[] = [];
        try {
          if (flatParams.length > 0) {
            stmt.bind(flatParams);
          }
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          return results;
        } finally {
          stmt.free();
        }
      }
    };
  },
  transaction(fn: () => any) {
    return () => {
      try {
        const res = fn();
        saveDbToFile();
        return res;
      } catch (err) {
        console.error('Transaction failed:', err);
        throw err;
      }
    };
  }
};

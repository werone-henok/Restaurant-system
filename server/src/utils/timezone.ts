import type { Request } from 'express';
import { db } from '../database/schema.js';

export interface ResolvedTimezone {
  mode: 'AUTO' | 'MANUAL';
  timeZone: string;
  offsetMinutes: number;
  modifier: string; // SQLite modifier, e.g. '+180 minutes' or '-300 minutes'
}

export const TIMEZONE_PRESETS = [
  { value: 'Africa/Addis_Ababa', label: 'Addis Ababa (EAT, UTC+3)', offsetMinutes: 180 },
  { value: 'Africa/Nairobi', label: 'Nairobi (EAT, UTC+3)', offsetMinutes: 180 },
  { value: 'Africa/Cairo', label: 'Cairo (EET, UTC+2)', offsetMinutes: 120 },
  { value: 'Asia/Dubai', label: 'Dubai (GST, UTC+4)', offsetMinutes: 240 },
  { value: 'Asia/Riyadh', label: 'Riyadh (AST, UTC+3)', offsetMinutes: 180 },
  { value: 'Europe/London', label: 'London (GMT, UTC+0)', offsetMinutes: 0 },
  { value: 'Europe/Paris', label: 'Paris (CET, UTC+1)', offsetMinutes: 60 },
  { value: 'America/New_York', label: 'New York (EST/EDT, UTC-5)', offsetMinutes: -300 },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT, UTC-8)', offsetMinutes: -480 },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offsetMinutes: 0 }
];

export function resolveTimezone(req: Request): ResolvedTimezone {
  // 1. Fetch system setting from DB
  let systemSettings: any = null;
  try {
    systemSettings = db.prepare('SELECT timezone_mode, system_timezone, timezone_offset_minutes FROM restaurant_settings LIMIT 1').get();
  } catch (_) {}

  const sysMode: 'AUTO' | 'MANUAL' = systemSettings?.timezone_mode === 'MANUAL' ? 'MANUAL' : 'AUTO';
  const sysTimezone = systemSettings?.system_timezone || 'Africa/Addis_Ababa';
  const sysOffsetMinutes = typeof systemSettings?.timezone_offset_minutes === 'number' 
    ? systemSettings.timezone_offset_minutes 
    : 180;

  // 2. Client-provided headers or query parameters
  const headerTz = req.headers['x-timezone'] as string | undefined;
  const headerOffset = req.headers['x-timezone-offset'] as string | undefined;
  const queryOffset = req.query.tzOffset as string | undefined;
  const queryTz = req.query.tz as string | undefined;

  let offsetMinutes = sysOffsetMinutes;
  let timeZone = sysTimezone;

  if (sysMode === 'AUTO') {
    // In AUTO mode, client device auto-detection takes priority
    if (headerOffset !== undefined && !isNaN(parseInt(headerOffset, 10))) {
      offsetMinutes = parseInt(headerOffset, 10);
    } else if (queryOffset !== undefined && !isNaN(parseInt(queryOffset, 10))) {
      offsetMinutes = parseInt(queryOffset, 10);
    }
    if (headerTz) timeZone = headerTz;
    else if (queryTz) timeZone = queryTz;
  } else {
    // In MANUAL mode, the restaurant system timezone is enforced,
    // unless explicitly overridden by an explicit query param
    if (queryOffset !== undefined && !isNaN(parseInt(queryOffset, 10))) {
      offsetMinutes = parseInt(queryOffset, 10);
    }
    if (queryTz) timeZone = queryTz;
  }

  // Safety boundaries: -720m (UTC-12) to +840m (UTC+14)
  if (isNaN(offsetMinutes) || offsetMinutes < -720 || offsetMinutes > 840) {
    offsetMinutes = 180;
  }

  const sign = offsetMinutes >= 0 ? '+' : '';
  const modifier = `${sign}${offsetMinutes} minutes`;

  return {
    mode: sysMode,
    timeZone,
    offsetMinutes,
    modifier
  };
}

// Format local 'YYYY-MM-DD' date string for a given timezone offset
export function getLocalDateStr(offsetMinutes: number, baseDate = new Date()): string {
  const targetDate = new Date(baseDate.getTime() + offsetMinutes * 60000);
  const y = targetDate.getUTCFullYear();
  const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Generate all consecutive dates between startDateStr and endDateStr (inclusive)
export function generateDateRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const curr = new Date(startDateStr + 'T00:00:00Z');
  const end = new Date(endDateStr + 'T00:00:00Z');
  let count = 0;
  while (curr <= end && count < 90) {
    const y = curr.getUTCFullYear();
    const m = String(curr.getUTCMonth() + 1).padStart(2, '0');
    const d = String(curr.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    curr.setUTCDate(curr.getUTCDate() + 1);
    count++;
  }
  return dates;
}

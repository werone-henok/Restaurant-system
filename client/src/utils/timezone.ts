export interface TimezoneOption {
  value: string;
  label: string;
  labelAm: string;
  offsetMinutes: number;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: 'Africa/Addis_Ababa', label: 'Addis Ababa (EAT, UTC+3)', labelAm: 'አዲስ አበባ (ምስራቅ አፍሪካ, UTC+3)', offsetMinutes: 180 },
  { value: 'Africa/Nairobi', label: 'Nairobi (EAT, UTC+3)', labelAm: 'ናይሮቢ (ምስራቅ አፍሪካ, UTC+3)', offsetMinutes: 180 },
  { value: 'Africa/Cairo', label: 'Cairo (EET, UTC+2)', labelAm: 'ካይሮ (ግብፅ, UTC+2)', offsetMinutes: 120 },
  { value: 'Asia/Dubai', label: 'Dubai (GST, UTC+4)', labelAm: 'ዱባይ (ባህረ ሰላጤ, UTC+4)', offsetMinutes: 240 },
  { value: 'Asia/Riyadh', label: 'Riyadh (AST, UTC+3)', labelAm: 'ሪያድ (ሳውዲ, UTC+3)', offsetMinutes: 180 },
  { value: 'Europe/London', label: 'London (GMT, UTC+0)', labelAm: 'ለንደን (GMT, UTC+0)', offsetMinutes: 0 },
  { value: 'Europe/Paris', label: 'Paris (CET, UTC+1)', labelAm: 'ፓሪስ (አውሮፓ, UTC+1)', offsetMinutes: 60 },
  { value: 'America/New_York', label: 'New York (EST, UTC-5)', labelAm: 'ኒው ዮርክ (UTC-5)', offsetMinutes: -300 },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST, UTC-8)', labelAm: 'ሎስ አንጀለስ (UTC-8)', offsetMinutes: -480 },
  { value: 'UTC', label: 'UTC (Universal Coordinated)', labelAm: 'ዩቲሲ (ዓለም አቀፍ UTC+0)', offsetMinutes: 0 }
];

export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Addis_Ababa';
  } catch (_) {
    return 'Africa/Addis_Ababa';
  }
}

export function getDeviceOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

/**
 * Safely parse a date string from the database (which SQLite returns in UTC as 'YYYY-MM-DD HH:MM:SS')
 * and ensure it is treated as UTC so the browser converts it to the user's local timezone.
 */
export function parseDbDate(dateStr: string | null | undefined | Date): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  let normalized = String(dateStr).trim();
  // If it's already an ISO string with Z or timezone offset (+XX:XX or -XX:XX), parse directly
  if (normalized.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(normalized)) {
    return new Date(normalized);
  }
  // If it's "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS" from SQLite, append Z so it is treated as UTC
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(normalized)) {
    normalized = normalized.replace(' ', 'T') + 'Z';
  }
  return new Date(normalized);
}

/**
 * Format a database timestamp to local time string (e.g. "11:59 AM" or "12:07 ከሰዓት")
 */
export function formatOrderTime(dateStr: string | null | undefined | Date, locale?: string | string[]): string {
  const d = parseDbDate(dateStr);
  return d.toLocaleTimeString(locale || [], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format a database timestamp to local date-time string (e.g. "Sep 24, 11:59 AM")
 */
export function formatOrderDateTime(dateStr: string | null | undefined | Date, locale?: string | string[]): string {
  const d = parseDbDate(dateStr);
  return d.toLocaleString(locale || [], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

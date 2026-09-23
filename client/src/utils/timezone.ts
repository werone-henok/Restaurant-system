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

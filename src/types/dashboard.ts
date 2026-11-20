// Shape of /api/dashboard. Every number here comes from the Google Health API;
// null means Google returned nothing for that day (never a made-up value).
export interface SleepStageInterval {
  stage: 'wake' | 'rem' | 'light' | 'deep';
  startTime: string; // local "HH:MM"
  endTime: string;
  durationMinutes: number;
}

export interface SleepSummary {
  date: string; // local date you woke up
  totalSleepMinutes: number;
  timeInBedMinutes: number;
  efficiency: number; // %
  deepMinutes: number;
  lightMinutes: number;
  remMinutes: number;
  wakeMinutes: number;
  stages: SleepStageInterval[];
  restlessEventsCount: number; // short awakenings
  baselineDiffMinutes: number;
  bedtime: string; // local "HH:MM"
  wakeTime: string;
}

export interface HrBucket {
  time: string; // local "HH:MM", start of a 5-minute bucket
  avg: number;
  min: number;
  max: number;
}

export interface HrZone {
  type: 'LIGHT' | 'MODERATE' | 'VIGOROUS' | 'PEAK';
  min: number;
  max: number;
}

export interface Exercise {
  name: string;
  start: string; // local "HH:MM"
  end: string;
  activeMinutes: number;
  kcal: number | null;
  avgHr: number | null;
  azm: number | null;
  steps: number | null;
  distanceMm: number | null;
}

export interface DayData {
  date: string; // local YYYY-MM-DD
  steps: number | null;
  distanceMm: number | null;
  caloriesKcal: number | null;
  azm: { fatBurn: number; cardio: number; peak: number; total: number } | null;
  restingHr: number | null;
  hrv: number | null; // ms, Fitbit's nightly HRV (same number the app shows)
  spo2: { avg: number; min: number; max: number } | null;
  respRate: number | null;
  skinTemp: { nightlyC: number; deviationC: number | null } | null;
  sleep: SleepSummary | null;
  napMinutes: number;
  heartRate: HrBucket[];
  hrZones: HrZone[];
  exercises: Exercise[];
}

export interface TrendPoint {
  date: string;
  steps: number | null;
  azm: number | null;
  restingHr: number | null;
  hrv: number | null;
  sleepMinutes: number | null;
  spo2: number | null;
  respRate: number | null;
  skinTempDevC: number | null;
  night: { bedtime: string; wakeTime: string; deep: number; light: number; rem: number; awake: number; efficiency: number } | null;
}

export interface Averages {
  // Mean of the other band days in the window that have data, plus how many days that is.
  restingHr: { value: number; days: number } | null;
  hrv: { value: number; days: number } | null;
  sleepMinutes: { value: number; days: number } | null;
  steps: { value: number; days: number } | null;
}

export interface DashboardData {
  date: string;
  today: string;
  bandSince: string | null; // first day the band recorded anything (within 30 days)
  timeZone: string;
  units: { distance: 'mi' | 'km'; temperature: 'C' | 'F' };
  device: { name: string; batteryLevel?: number; batteryStatus?: string; lastSyncTime?: string } | null;
  account?: { email: string; name: string | null }; // added by the API route for the signed-in user
  day: DayData;
  trends: TrendPoint[]; // oldest -> newest, from bandSince up to today (max 30 days)
  averages: Averages;
  errors: Record<string, string>; // per-source failures, so the UI can say what is missing
}

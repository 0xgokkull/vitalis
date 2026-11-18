// Server-only: reads real data from the Google Health API using the signed-in user's stored refresh token.
import { AsyncLocalStorage } from 'node:async_hooks';
import { HEALTH_API, refreshAccessToken } from './googleHealth';
import { getServiceSupabase } from './supabase';
import type {
  SleepStageInterval, SleepSummary,
  Averages, DashboardData, DayData, Exercise, HrBucket, HrZone, TrendPoint,
} from '../types/dashboard';

// ---------- auth + HTTP ----------

// Every Google call below runs on behalf of one user, set by asUser() for the whole request.
const currentUser = new AsyncLocalStorage<string>();
export const asUser = <T>(email: string, fn: () => Promise<T>) => currentUser.run(email, fn);
function userEmail(): string {
  const e = currentUser.getStore();
  if (!e) throw new Error('signed_out');
  return e;
}

const accessTokens = new Map<string, { token: string; expiresAt: number }>();

async function getTokenRow() {
  const { data, error } = await getServiceSupabase()
    .from('fitbit_tokens')
    .select('refresh_token, updated_at')
    .eq('user_email', userEmail())
    .maybeSingle();
  if (error || !data) throw new Error('not_connected');
  return data as { refresh_token: string; updated_at: string };
}

export async function getAccessToken(): Promise<string> {
  const email = userEmail();
  const hit = accessTokens.get(email);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;
  const row = await getTokenRow();
  try {
    const t = await refreshAccessToken(row.refresh_token);
    accessTokens.set(email, { token: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 });
    return t.access_token;
  } catch (e) {
    // Revoked, expired (Testing-mode apps get 7-day refresh tokens), or issued to a
    // previous OAuth client: either way they need to connect again.
    if (/invalid_grant|unauthorized_client|invalid_client/.test((e as Error).message)) throw new Error('needs_reauth');
    throw e;
  }
}

async function call(path: string, init?: { body?: unknown; query?: Record<string, string> }) {
  const url = new URL(`${HEALTH_API}/${path}`);
  for (const [k, v] of Object.entries(init?.query ?? {})) url.searchParams.set(k, v);
  // Google Health sometimes answers 503/429 for a moment; retry those with a short backoff.
  for (let attempt = 0; ; attempt++) {
    const res = await fetchOnce(url, init);
    if ((res.status === 503 || res.status === 429 || res.status === 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
      continue;
    }
    return parse(res);
  }
}

async function fetchOnce(url: URL, init?: { body?: unknown }) {
  return fetch(url, {
    method: init?.body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
}

async function parse(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const insufficient = json?.error?.details?.some(
      (d: { reason?: string }) => d.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT'
    );
    throw new Error(insufficient ? 'needs_reauth' : json?.error?.message ?? `HTTP ${res.status}`);
  }
  return json;
}

// List all pages of a data type (newest first).
async function listAll<T>(dataType: string, filter: string, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  let pageToken: string | undefined;
  do {
    const json = await call(`users/me/dataTypes/${dataType}/dataPoints`, {
      query: { filter, pageSize: String(pageSize), ...(pageToken ? { pageToken } : {}) },
    });
    out.push(...(json.dataPoints ?? []));
    pageToken = json.nextPageToken || undefined;
  } while (pageToken && out.length < 5000);
  return out;
}

// ---------- dates / time zones ----------

interface CivilDate { year: number; month: number; day: number }
const civilToYmd = (d: CivilDate) =>
  `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
const ymdToCivil = (s: string): CivilDate => {
  const [year, month, day] = s.split('-').map(Number);
  return { year, month, day };
};
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function todayIn(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

// Offset of `tz` from UTC (minutes) at a given instant.
function tzOffsetMin(tz: string, at: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(at).map((x) => [x.type, x.value])
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - at.getTime()) / 60000);
}

// UTC instant of local midnight starting `ymd` in `tz`.
function localMidnightUtc(ymd: string, tz: string): Date {
  const guess = new Date(`${ymd}T00:00:00Z`);
  return new Date(guess.getTime() - tzOffsetMin(tz, guess) * 60000);
}

function hhmmIn(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(iso));
}

// Shift by the record's own offset ("19800s") so times read in the wearer's zone.
function localByOffset(iso: string, offset = '0s'): Date {
  return new Date(Date.parse(iso) + parseInt(offset, 10) * 1000);
}
const hhmmUtc = (d: Date) =>
  `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

// ---------- settings + device ----------

const lastSettings = new Map<string, Awaited<ReturnType<typeof fetchSettings>>>();

// Time zone and units drive every timestamp on the page, so never guess them:
// use the last good answer, or fail loudly.
async function getSettings() {
  const email = userEmail();
  try {
    lastSettings.set(email, await fetchSettings());
  } catch (e) {
    const msg = (e as Error).message;
    if (['needs_reauth', 'not_connected', 'signed_out'].includes(msg)) throw e;
    if (!lastSettings.has(email)) throw new Error(`Couldn't read your time zone from Google (${msg}). Try Refresh.`);
  }
  return lastSettings.get(email)!;
}

async function fetchSettings() {
  const s = await call('users/me/settings');
  return {
    timeZone: (s.timeZone as string) || 'UTC',
    units: {
      distance: s.distanceUnit === 'DISTANCE_UNIT_MILES' ? 'mi' : 'km',
      temperature: s.temperatureUnit === 'TEMPERATURE_UNIT_FAHRENHEIT' ? 'F' : 'C',
    } as DashboardData['units'],
  };
}

async function getDevice(): Promise<DashboardData['device']> {
  const json = await call('users/me/pairedDevices');
  const list = (json.pairedDevices ?? []) as Array<Record<string, unknown>>;
  const d = list.find((x) => x.deviceType === 'TRACKER') ?? list[0];
  if (!d) return null;
  return {
    name: (d.deviceVersion as string) ?? 'Fitbit',
    batteryLevel: d.batteryLevel as number | undefined,
    batteryStatus: d.batteryStatus as string | undefined,
    lastSyncTime: d.lastSyncTime as string | undefined,
  };
}

// ---------- daily rollups (steps, distance, calories, AZM) ----------

// Only count what the Fitbit band recorded. Without this, Google merges in phone
// data (e.g. Apple Health steps), which the band never measured.
const BAND_ONLY = 'users/me/dataSourceFamilies/google-wearables';

interface RollupPoint { civilStartTime: { date: CivilDate }; [k: string]: unknown }

async function dailyRollup(dataType: string, start: string, endExclusive: string): Promise<Map<string, RollupPoint>> {
  const json = await call(`users/me/dataTypes/${dataType}/dataPoints:dailyRollUp`, {
    body: {
      range: { start: { date: ymdToCivil(start) }, end: { date: ymdToCivil(endExclusive) } },
      dataSourceFamily: BAND_ONLY,
    },
  });
  const map = new Map<string, RollupPoint>();
  for (const p of (json.rollupDataPoints ?? []) as RollupPoint[]) map.set(civilToYmd(p.civilStartTime.date), p);
  return map;
}

// ---------- daily summaries (RHR, HRV, SpO2, respiration, skin temp, HR zones) ----------

async function dailyList<T>(dataType: string, field: string, key: string, start: string, endExclusive: string) {
  const points = await listAll<Record<string, T & { date: CivilDate }>>(
    dataType,
    `${field}.date >= "${start}" AND ${field}.date < "${endExclusive}"`
  );
  const map = new Map<string, T & { date: CivilDate }>();
  for (const p of points) {
    const v = p[key];
    if (v) map.set(civilToYmd(v.date), v);
  }
  return map;
}

// ---------- sleep ----------

interface RawInterval { startTime: string; endTime: string; startUtcOffset?: string; endUtcOffset?: string }
interface RawSleep {
  interval: RawInterval;
  stages?: (RawInterval & { type: string })[];
  shortAwakenings?: RawInterval[];
  metadata?: { mainSleep?: boolean; nap?: boolean };
  summary: {
    minutesInSleepPeriod: string;
    minutesAsleep: string;
    minutesAwake: string;
    stagesSummary?: { type: string; minutes: string }[];
  };
}

const STAGE: Record<string, SleepStageInterval['stage']> = { AWAKE: 'wake', LIGHT: 'light', DEEP: 'deep', REM: 'rem' };

function sleepWakeDate(s: RawSleep) {
  return localByOffset(s.interval.endTime, s.interval.endUtcOffset).toISOString().slice(0, 10);
}

function toSleepSummary(s: RawSleep, avgAsleep: number | null): SleepSummary {
  const mins = (t: string) => Number(s.summary.stagesSummary?.find((x) => x.type === t)?.minutes ?? 0);
  const asleep = Number(s.summary.minutesAsleep);
  const inBed = Number(s.summary.minutesInSleepPeriod);
  const stages: SleepStageInterval[] = (s.stages ?? []).map((st) => {
    const a = localByOffset(st.startTime, st.startUtcOffset);
    const b = localByOffset(st.endTime, st.endUtcOffset);
    return {
      stage: STAGE[st.type] ?? 'light',
      startTime: hhmmUtc(a),
      endTime: hhmmUtc(b),
      durationMinutes: Math.round((b.getTime() - a.getTime()) / 60000),
    };
  });
  return {
    date: sleepWakeDate(s),
    totalSleepMinutes: asleep,
    timeInBedMinutes: inBed,
    efficiency: inBed ? Math.round((asleep / inBed) * 100) : 0,
    deepMinutes: mins('DEEP'),
    lightMinutes: mins('LIGHT'),
    remMinutes: mins('REM'),
    wakeMinutes: mins('AWAKE') || Number(s.summary.minutesAwake),
    stages,
    restlessEventsCount: s.shortAwakenings?.length ?? 0,
    baselineDiffMinutes: avgAsleep != null ? Math.round(asleep - avgAsleep) : 0,
    bedtime: hhmmUtc(localByOffset(s.interval.startTime, s.interval.startUtcOffset)),
    wakeTime: hhmmUtc(localByOffset(s.interval.endTime, s.interval.endUtcOffset)),
  };
}

async function getSleeps(start: string, endExclusive: string): Promise<RawSleep[]> {
  const pts = await listAll<{ sleep: RawSleep }>(
    'sleep',
    `sleep.interval.civil_end_time >= "${start}" AND sleep.interval.civil_end_time < "${endExclusive}"`,
    25 // API max for sleep
  );
  return pts.map((p) => p.sleep);
}

// ---------- intraday heart rate + exercise (selected day only) ----------

async function getHeartRate(date: string, tz: string): Promise<HrBucket[]> {
  const start = localMidnightUtc(date, tz);
  const end = new Date(Math.min(localMidnightUtc(addDays(date, 1), tz).getTime(), Date.now()));
  const json = await call('users/me/dataTypes/heart-rate/dataPoints:rollUp', {
    body: {
      range: { startTime: start.toISOString(), endTime: end.toISOString() },
      windowSize: '300s',
      pageSize: 400,
    },
  });
  type P = { startTime: string; heartRate?: { beatsPerMinuteAvg: number; beatsPerMinuteMin: number; beatsPerMinuteMax: number } };
  return ((json.rollupDataPoints ?? []) as P[])
    .filter((p) => p.heartRate)
    .map((p) => ({
      time: hhmmIn(p.startTime, tz),
      avg: Math.round(p.heartRate!.beatsPerMinuteAvg),
      min: p.heartRate!.beatsPerMinuteMin,
      max: p.heartRate!.beatsPerMinuteMax,
      ts: Date.parse(p.startTime),
    }))
    .sort((a, b) => a.ts - b.ts)
    .map(({ ts: _ts, ...rest }) => rest); // eslint-disable-line @typescript-eslint/no-unused-vars
}

async function getExercises(date: string, tz: string, days = 1): Promise<(Exercise & { date: string })[]> {
  type E = {
    exercise: {
      interval: RawInterval; displayName?: string; exerciseType?: string; activeDuration?: string;
      metricsSummary?: Record<string, string | number>;
    };
  };
  const pts = await listAll<E>(
    'exercise',
    `exercise.interval.civil_start_time >= "${date}" AND exercise.interval.civil_start_time < "${addDays(date, days)}"`,
    25
  );
  return pts
    .map(({ exercise: e }) => {
      const m = e.metricsSummary ?? {};
      return {
        date: new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(e.interval.startTime)),
        name: e.displayName ?? e.exerciseType ?? 'Exercise',
        start: hhmmIn(e.interval.startTime, tz),
        end: hhmmIn(e.interval.endTime, tz),
        activeMinutes: Math.floor(parseFloat(e.activeDuration ?? '0') / 60), // floor, like the Fitbit app
        kcal: num(m.caloriesKcal),
        avgHr: num(m.averageHeartRateBeatsPerMinute),
        azm: num(m.activeZoneMinutes),
        steps: num(m.steps),
        distanceMm: num(m.distanceMillimeters),
      };
    })
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

// Every workout in a date range (for the coach).
export async function getWorkouts(from: string, to: string, tz: string) {
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  return getExercises(from, tz, days);
}

// ---------- the whole dashboard ----------

export async function getDashboard(requestedDate?: string): Promise<DashboardData> {
  const errors: Record<string, string> = {};
  const safe = async <T>(name: string, p: Promise<T>, fallback: T): Promise<T> => {
    try { return await p; } catch (e) { errors[name] = (e as Error).message; return fallback; }
  };

  const settings = await getSettings();
  const tz = settings.timeZone;
  const today = todayIn(tz);
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate <= today ? requestedDate : today;
  // The 30-day window always ends today, so trends don't shift while browsing days.
  const start = addDays(today, -29);
  const end = addDays(today, 1); // exclusive

  type RHR = { beatsPerMinute: string };
  type HRV = { averageHeartRateVariabilityMilliseconds: number };
  type SPO2 = { averagePercentage: number; lowerBoundPercentage: number; upperBoundPercentage: number };
  type RESP = { breathsPerMinute: number };
  type TEMP = { nightlyTemperatureCelsius: number | string; baselineTemperatureCelsius: number | string };
  type ZONES = { heartRateZones: { heartRateZoneType: HrZone['type']; minBeatsPerMinute: string; maxBeatsPerMinute: string }[] };

  const [
    device, steps, distance, calories, azm, rhr, hrv, spo2, resp, temp, zones, sleeps, heartRate, exercises,
  ] = await Promise.all([
    safe('device', getDevice(), null),
    safe('steps', dailyRollup('steps', start, end), new Map()),
    safe('distance', dailyRollup('distance', start, end), new Map()),
    // total-calories rollups are limited to 14 days
    safe('calories', dailyRollup('total-calories', addDays(date, -13), end), new Map()),
    safe('azm', dailyRollup('active-zone-minutes', start, end), new Map()),
    safe('restingHr', dailyList<RHR>('daily-resting-heart-rate', 'daily_resting_heart_rate', 'dailyRestingHeartRate', start, end), new Map()),
    safe('hrv', dailyList<HRV>('daily-heart-rate-variability', 'daily_heart_rate_variability', 'dailyHeartRateVariability', start, end), new Map()),
    safe('spo2', dailyList<SPO2>('daily-oxygen-saturation', 'daily_oxygen_saturation', 'dailyOxygenSaturation', start, end), new Map()),
    safe('respRate', dailyList<RESP>('daily-respiratory-rate', 'daily_respiratory_rate', 'dailyRespiratoryRate', start, end), new Map()),
    safe('skinTemp', dailyList<TEMP>('daily-sleep-temperature-derivations', 'daily_sleep_temperature_derivations', 'dailySleepTemperatureDerivations', start, end), new Map()),
    safe('hrZones', dailyList<ZONES>('daily-heart-rate-zones', 'daily_heart_rate_zones', 'dailyHeartRateZones', date, addDays(date, 1)), new Map()),
    safe('sleep', getSleeps(start, end), [] as RawSleep[]),
    safe('heartRate', getHeartRate(date, tz), [] as HrBucket[]),
    safe('exercise', getExercises(date, tz), [] as Exercise[]),
  ]);

  // Sleep: one main sleep per wake-up date; naps summed separately.
  const mainByDate = new Map<string, RawSleep>();
  const napMinutesByDate = new Map<string, number>();
  for (const s of sleeps) {
    const d = sleepWakeDate(s);
    if (s.metadata?.mainSleep) {
      const prev = mainByDate.get(d);
      if (!prev || Number(s.summary.minutesAsleep) > Number(prev.summary.minutesAsleep)) mainByDate.set(d, s);
    } else {
      napMinutesByDate.set(d, (napMinutesByDate.get(d) ?? 0) + Number(s.summary.minutesAsleep));
    }
  }

  // Google omits AZM rows for days with no zone minutes; that is 0 when the day has any step data.
  const azmOf = (p: RollupPoint | undefined, d: string) => {
    const a = p?.activeZoneMinutes as Record<string, string> | undefined;
    if (!a) return steps.has(d) ? { fatBurn: 0, cardio: 0, peak: 0, total: 0 } : null;
    const fatBurn = Number(a.sumInFatBurnHeartZone ?? 0);
    const cardio = Number(a.sumInCardioHeartZone ?? 0);
    const peak = Number(a.sumInPeakHeartZone ?? 0);
    return { fatBurn, cardio, peak, total: fatBurn + cardio + peak };
  };
  const tempDev = (t?: TEMP) => {
    const n = num(t?.nightlyTemperatureCelsius);
    const b = num(t?.baselineTemperatureCelsius);
    return n != null && b != null ? Math.round((n - b) * 100) / 100 : null;
  };

  // First day the band recorded anything; earlier days are left out entirely.
  const bandDays = [...steps.keys(), ...rhr.keys(), ...mainByDate.keys()].filter((d) => d >= start).sort();
  const bandSince = bandDays[0] ?? null;

  // Trend rows from the band's first day (at most 30 days) up to today
  const trends: TrendPoint[] = [];
  for (let d = bandSince ?? today; d <= today; d = addDays(d, 1)) {
    const s = mainByDate.get(d);
    trends.push({
      date: d,
      steps: num((steps.get(d)?.steps as { countSum?: string } | undefined)?.countSum),
      azm: azmOf(azm.get(d), d)?.total ?? null,
      restingHr: num(rhr.get(d)?.beatsPerMinute),
      hrv: num(hrv.get(d)?.averageHeartRateVariabilityMilliseconds),
      sleepMinutes: s ? Number(s.summary.minutesAsleep) : null,
      spo2: num(spo2.get(d)?.averagePercentage),
      respRate: num(resp.get(d)?.breathsPerMinute),
      skinTempDevC: tempDev(temp.get(d)),
      night: s
        ? (({ bedtime, wakeTime, deepMinutes, lightMinutes, remMinutes, wakeMinutes, efficiency }) => ({
            bedtime, wakeTime, deep: deepMinutes, light: lightMinutes, rem: remMinutes, awake: wakeMinutes, efficiency,
          }))(toSleepSummary(s, null))
        : null,
    });
  }

  const avgOther = (pick: (t: TrendPoint) => number | null) => {
    // Leave out the day being viewed, and today, which isn't over yet.
    const vals = trends.filter((t) => t.date !== date && t.date !== today).map(pick).filter((v): v is number => v != null);
    return vals.length ? { value: vals.reduce((a, b) => a + b, 0) / vals.length, days: vals.length } : null;
  };
  const averages: Averages = {
    restingHr: avgOther((t) => t.restingHr),
    hrv: avgOther((t) => t.hrv),
    sleepMinutes: avgOther((t) => t.sleepMinutes),
    steps: avgOther((t) => t.steps),
  };

  const s = spo2.get(date);
  const t = temp.get(date);
  const tNightly = num(t?.nightlyTemperatureCelsius);
  const sleepRaw = mainByDate.get(date);
  const zoneRow = zones.get(date);

  const day: DayData = {
    date,
    steps: trends.find((r) => r.date === date)?.steps ?? null,
    distanceMm: num((distance.get(date)?.distance as { millimetersSum?: string } | undefined)?.millimetersSum),
    caloriesKcal: (() => {
      const k = num((calories.get(date)?.totalCalories as { kcalSum?: number } | undefined)?.kcalSum);
      return k == null ? null : Math.round(k);
    })(),
    azm: azmOf(azm.get(date), date),
    restingHr: num(rhr.get(date)?.beatsPerMinute),
    hrv: num(hrv.get(date)?.averageHeartRateVariabilityMilliseconds),
    spo2: s ? { avg: s.averagePercentage, min: s.lowerBoundPercentage, max: s.upperBoundPercentage } : null,
    respRate: num(resp.get(date)?.breathsPerMinute),
    skinTemp: tNightly != null ? { nightlyC: tNightly, deviationC: tempDev(t) } : null,
    sleep: sleepRaw ? toSleepSummary(sleepRaw, averages.sleepMinutes?.value ?? null) : null,
    napMinutes: napMinutesByDate.get(date) ?? 0,
    heartRate,
    hrZones: ((zoneRow?.heartRateZones ?? []) as ZONES['heartRateZones']).map((z) => ({
      type: z.heartRateZoneType, min: Number(z.minBeatsPerMinute), max: Number(z.maxBeatsPerMinute),
    })),
    exercises,
  };

  return { date, today, bandSince, timeZone: tz, units: settings.units, device, day, trends, averages, errors };
}

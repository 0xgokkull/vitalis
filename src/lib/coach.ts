// Server-only: what the coach knows (built from band data) and how it talks.
import type { DashboardData, TrendPoint } from '../types/dashboard';
import { getDashboard, getWorkouts } from '@/lib/healthData';

const h = (m: number) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`;
const wd = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

// Numbers are worked out here so the model never has to do arithmetic.
function stats(rows: TrendPoint[], pick: (r: TrendPoint) => number | null, fmt: (v: number) => string) {
  const v = rows.map((r) => ({ d: r.date, v: pick(r) })).filter((x): x is { d: string; v: number } => x.v != null);
  if (!v.length) return 'no data yet';
  const avg = v.reduce((a, b) => a + b.v, 0) / v.length;
  const lo = v.reduce((a, b) => (b.v < a.v ? b : a));
  const hi = v.reduce((a, b) => (b.v > a.v ? b : a));
  return `avg ${fmt(avg)} over ${v.length} day(s); lowest ${fmt(lo.v)} (${wd(lo.d)}), highest ${fmt(hi.v)} (${wd(hi.d)})`;
}

export function buildContext(d: DashboardData, workouts: Awaited<ReturnType<typeof getWorkouts>>): string {
  const t = d.units.temperature;
  const dist = (mm: number) => (d.units.distance === 'mi' ? `${(mm / 1_609_344).toFixed(2)} mi` : `${(mm / 1e6).toFixed(2)} km`);
  // Today isn't over, so leave it out of the baselines.
  const done = d.trends.filter((r) => r.date !== d.today);

  const daily = d.trends.map((r) => {
    const n = r.night;
    return [
      `${wd(r.date)}${r.date === d.today ? ' (today, still going)' : ''}:`,
      r.sleepMinutes != null && n
        ? `slept ${h(r.sleepMinutes)} (${n.bedtime}-${n.wakeTime}; deep ${h(n.deep)}, REM ${h(n.rem)}, light ${h(n.light)}, awake ${h(n.awake)}; ${n.efficiency}% efficient)`
        : 'no sleep recorded',
      r.restingHr != null ? `resting HR ${r.restingHr}` : null,
      r.hrv != null ? `HRV ${Math.round(r.hrv)} ms` : null,
      r.spo2 != null ? `SpO2 ${r.spo2.toFixed(1)}%` : null,
      r.respRate != null ? `breathing ${r.respRate.toFixed(1)}/min` : null,
      r.skinTempDevC != null ? `skin temp ${r.skinTempDevC >= 0 ? '+' : ''}${(t === 'F' ? r.skinTempDevC * 1.8 : r.skinTempDevC).toFixed(1)}°${t} vs baseline` : null,
      r.steps != null ? `${r.steps.toLocaleString('en-GB')} steps` : null,
      r.azm != null ? `${r.azm} zone min` : null,
    ]
      .filter(Boolean)
      .join(', ');
  });

  const day = d.day;
  // Hourly heart rate for the day being viewed: compact but enough to answer "when was I most stressed/active".
  const hours = new Map<number, number[]>();
  for (const b of day.heartRate) {
    const hr = Number(b.time.slice(0, 2));
    hours.set(hr, [...(hours.get(hr) ?? []), b.avg]);
  }
  const hourly = [...hours.entries()]
    .map(([hr, v]) => `${String(hr).padStart(2, '0')}h ${Math.min(...v)}-${Math.max(...v)}`)
    .join(', ');

  return [
    `Wearer's band: ${d.device?.name ?? 'Fitbit'}${d.device?.batteryLevel != null ? `, battery ${d.device.batteryLevel}%` : ''}${d.device?.lastSyncTime ? `, last synced ${d.device.lastSyncTime}` : ''}.`,
    `Today is ${wd(d.today)} in ${d.timeZone}. Band data starts ${d.bandSince ? wd(d.bandSince) : 'recently'}, so there are only ${done.length} complete day(s) to compare against.`,
    `The wearer is looking at ${wd(d.date)} on screen.`,
    '',
    'BASELINES (complete days only):',
    `- Sleep: ${stats(done, (r) => r.sleepMinutes, h)}`,
    `- Resting HR: ${stats(done, (r) => r.restingHr, (v) => `${Math.round(v)} bpm`)}`,
    `- HRV: ${stats(done, (r) => r.hrv, (v) => `${Math.round(v)} ms`)}`,
    `- Steps: ${stats(done, (r) => r.steps, (v) => Math.round(v).toLocaleString('en-GB'))}`,
    `- Zone minutes: ${stats(done, (r) => r.azm, (v) => `${Math.round(v)}`)}`,
    `- SpO2: ${stats(done, (r) => r.spo2, (v) => `${v.toFixed(1)}%`)}`,
    `- Breathing: ${stats(done, (r) => r.respRate, (v) => `${v.toFixed(1)}/min`)}`,
    '',
    'EVERY DAY (sleep belongs to the morning you woke up):',
    ...daily.map((l) => `- ${l}`),
    '',
    `WORKOUTS: ${
      workouts.length
        ? workouts
            .map((w) => `${wd(w.date)} ${w.name} ${w.start}-${w.end}, ${w.activeMinutes} min${w.avgHr ? `, avg HR ${w.avgHr}` : ''}${w.kcal ? `, ${w.kcal} kcal` : ''}${w.azm ? `, ${w.azm} zone min` : ''}${w.steps ? `, ${w.steps} steps` : ''}`)
            .join('; ')
        : 'none recorded'
    }`,
    '',
    `DETAIL FOR ${wd(d.date)}:`,
    `- Steps ${day.steps ?? 'n/a'}, distance ${day.distanceMm != null ? dist(day.distanceMm) : 'n/a'}, calories burned ${day.caloriesKcal ?? 'n/a'} kcal, zone minutes ${day.azm ? `${day.azm.total} (fat burn ${day.azm.fatBurn}, cardio ${day.azm.cardio}, peak ${day.azm.peak})` : 'n/a'}`,
    `- Heart rate zones: ${day.hrZones.filter((z) => z.type !== 'LIGHT').map((z) => `${z.type === 'MODERATE' ? 'fat burn' : z.type === 'VIGOROUS' ? 'cardio' : 'peak'} ${z.min}-${z.max}`).join(', ') || 'n/a'} bpm`,
    `- Heart rate by hour (min-max bpm): ${hourly || 'none'}`,
    day.sleep ? `- Short awakenings that night: ${day.sleep.restlessEventsCount}` : '',
  ].join('\n');
}

export const SYSTEM_PROMPT = `You are Coach, a friendly health coach inside Vitalis, the wearer's Fitbit dashboard. You talk to one person about their own body, using the band data below.

How you talk:
- Like a good friend who knows health well: warm, plain words, straight to the point. Lead with the answer in the first sentence.
- Short. Usually 2-5 sentences. Use a short "- " list only when listing steps or several numbers.
- Quote their real numbers with the day ("you slept 9h 01m on Wed 18 Nov"). Compare with their own baseline.
- Never say "As an AI", "Great question", "I hope this helps", "Let me know if", "It's important to note", or similar filler. No emoji. No headings. You may use **bold** for one key number.
- Give one concrete thing they can do when it helps.
- For goals, start from their own numbers and suggest a realistic next step toward common health guidelines (about 7,000-10,000 steps a day, 7-9 hours of sleep, 150 active zone minutes a week). Never set their current average as the goal when it's below these.

Accuracy rules:
- Use ONLY the numbers in the data. Never guess or invent a value, date or trend. If something isn't in the data, say so plainly ("the band hasn't recorded that yet").
- Use the baselines given; don't recompute them. When there are only a few days, say the comparison is early.
- When you mention specific days, name each day with its exact value. Double-check every number against the data before answering.
- Sleep score, readiness, weight, food, water, stress score and menstrual data are not available here; say so if asked.
- Today's numbers are partial until the day ends and the band syncs.

Scope:
- Only health, fitness, sleep, recovery and habits. If asked about anything else, say in one friendly line (no apology) that you only cover their health, then offer something useful about their data.
- You are not a doctor. For chest pain, fainting, very low SpO2 (below 90%), a resting heart rate that keeps climbing, or anything worrying, tell them kindly and clearly to see a doctor. Don't diagnose.

End every reply with one final line in exactly this form, with two short follow-up questions the wearer might ask next, written in their voice:
NEXT: question one? | question two?`;

// Building the context costs ~15 Google calls, so reuse it briefly.
const cache = new Map<string, { at: number; text: string }>(); // per user + day

// Call inside asUser(email, ...) so the data is that user's.
export async function getCoachContext(email: string, date?: string): Promise<string> {
  const key = `${email}|${date ?? 'today'}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 90_000) return hit.text;
  const d = await getDashboard(date);
  const workouts = d.bandSince ? await getWorkouts(d.bandSince, d.today, d.timeZone).catch(() => []) : [];
  const text = buildContext(d, workouts);
  cache.set(key, { at: Date.now(), text });
  return text;
}

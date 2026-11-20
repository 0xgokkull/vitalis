'use client';

import { useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { DashboardData, TrendPoint } from '../types/dashboard';
import { ago, relativeDay, shiftDate, shortDate, signed, tempDelta } from '../lib/format';
import { CountUp } from './CountUp';
import { DayStrip } from './DayStrip';
import type { TrendKey } from './TrendsPanel';
import { EXPLAIN } from './explain';

interface Props {
  data: DashboardData;
  onDate: (d: string) => void;
  onMetric: (k: TrendKey) => void;
  part: 'date' | 'vitals'; // rendered separately so the dial can sit between them on phones
}

interface Vital {
  key: TrendKey;
  name: string;
  value: number | null;
  format: (v: number) => string;
  unit?: string;
  color: string;
  note?: string;
  good?: boolean | null; // true = better than usual, false = worse, null = neutral
}

function compare(value: number | null, avg: { value: number; days: number } | null, higherIsBetter: boolean, unit = '') {
  if (value == null || !avg) return { note: undefined, good: null };
  const diff = value - avg.value;
  if (Math.abs(diff) < 0.5) return { note: `In line with your ${avg.days}-day average`, good: null };
  return { note: `${signed(diff)}${unit} on your ${avg.days}-day average`, good: (diff > 0) === higherIsBetter };
}

// Tiny line of the band days so far, with the viewed day marked.
function Spark({ rows, k, date, color }: { rows: TrendPoint[]; k: TrendKey; date: string; color: string }) {
  const pts = rows.map((r, i) => ({ i, v: r[k], on: r.date === date })).filter((p): p is { i: number; v: number; on: boolean } => p.v != null);
  if (pts.length < 2) return null;
  const W = 72, H = 26;
  const lo = Math.min(...pts.map((p) => p.v));
  const hi = Math.max(...pts.map((p) => p.v));
  const x = (i: number) => 3 + (i / Math.max(rows.length - 1, 1)) * (W - 6);
  const y = (v: number) => H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 8);
  const on = pts.find((p) => p.on);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[72px] h-[26px] shrink-0" aria-hidden>
      <polyline points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.55" strokeLinejoin="round" strokeLinecap="round" />
      {on && <circle cx={x(on.i)} cy={y(on.v)} r="3" fill={color} />}
    </svg>
  );
}

export function Hero({ data, onDate, onMetric, part }: Props) {
  const d = data.day;
  const a = data.averages;
  const t = data.units.temperature;
  const weekday = new Date(`${data.date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  const dayMonth = new Date(`${data.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });

  const int = useCallback((v: number) => Math.round(v).toString(), []);
  const one = useCallback((v: number) => v.toFixed(1), []);
  const temp = useCallback((v: number) => signed(tempDelta(v, t), 1), [t]);

  if (part === 'date')
    return (
      <div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={data.date}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-flex items-center gap-2 text-sm text-ink-2">
              <span className={`w-2 h-2 rounded-full ${data.date === data.today ? 'bg-move' : 'bg-muted'}`} />
              {relativeDay(data.date, data.today)}
            </span>
            <h1 className="mt-2 font-display leading-[0.92] tracking-[-0.035em]">
              <span className="block text-[clamp(3rem,7vw,5.25rem)] font-bold text-ink">{weekday}</span>
              <span className="block text-[clamp(2rem,4.5vw,3.25rem)] font-light text-ink-2">{dayMonth}</span>
            </h1>
          </motion.div>
        </AnimatePresence>
        <div className="mt-6">
          <DayStrip data={data} onDate={onDate} />
        </div>
      </div>
    );

  const vitals: Vital[] = [
    { key: 'restingHr', name: 'Resting heart rate', value: d.restingHr, format: int, unit: 'bpm', color: 'var(--heart)', ...compare(d.restingHr, a.restingHr, false) },
    { key: 'hrv', name: 'Heart rate variability (HRV)', value: d.hrv, format: int, unit: 'ms', color: 'var(--rem)', ...compare(d.hrv, a.hrv, true) },
    { key: 'spo2', name: 'Blood oxygen', value: d.spo2?.avg ?? null, format: one, unit: '%', color: 'var(--breath)', note: d.spo2 ? `Overnight range ${d.spo2.min}–${d.spo2.max}%` : undefined, good: null },
    { key: 'respRate', name: 'Breathing rate', value: d.respRate, format: one, unit: 'breaths/min', color: 'var(--breath)', note: d.respRate != null ? 'Average while asleep' : undefined, good: null },
    {
      key: 'skinTempDevC',
      name: 'Skin temperature',
      value: d.skinTemp?.deviationC ?? null,
      format: temp,
      unit: `°${t}`,
      color: 'var(--awake)',
      note: d.skinTemp?.deviationC != null ? 'Difference from your baseline' : d.skinTemp ? 'Your baseline is still forming' : undefined,
      good: null,
    },
  ];

  // Overnight readings only land after you wake up and the band syncs.
  if (vitals.every((v) => v.value == null)) {
    const yesterday = shiftDate(data.date, -1);
    const canGoBack = data.trends.some((r) => r.date === yesterday);
    const isToday = data.date === data.today;
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel p-6 sm:p-7 max-w-xl">
        <div className="flex items-center gap-3">
          <span className="relative flex w-3 h-3" aria-hidden>
            {isToday && <span className="absolute inset-0 rounded-full bg-sleep opacity-60 animate-ping" />}
            <span className="relative w-3 h-3 rounded-full bg-sleep" />
          </span>
          <h2 className="font-display text-xl font-semibold">{isToday ? 'Waiting for last night' : 'No overnight readings'}</h2>
        </div>
        <p className="mt-2 text-ink-2 leading-relaxed">
          {isToday
            ? `Resting heart rate, HRV, blood oxygen, breathing and skin temperature arrive after you wake up and your band syncs with the Fitbit app.${data.device?.lastSyncTime ? ` Last sync was ${ago(data.device.lastSyncTime)}.` : ''}`
            : 'The band wasn’t worn to bed that night, so there are no overnight readings.'}
        </p>
        {canGoBack && (
          <button onClick={() => onDate(yesterday)} className="mt-5 h-10 px-5 rounded-full bg-ink text-bg text-sm font-semibold hover:opacity-90 transition-opacity">
            See {shortDate(yesterday)}
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 -mx-1 sm:-mx-3" aria-label="Overnight readings">
      {vitals.map((v, i) => (
        <li key={v.key} className="flex">
          <button
            onClick={() => onMetric(v.key)}
            title={`Show ${v.name.toLowerCase()} over time`}
            className="group relative w-full text-left rounded-2xl px-3 py-3 pl-6 hover:bg-surface transition-colors"
          >
            <span className="absolute left-3 top-4 bottom-4 w-[3px] rounded-full transition-all group-hover:top-3 group-hover:bottom-3" style={{ background: v.color }} />
            <span className="text-sm text-ink-2 flex items-center justify-between gap-2">
              {v.name}
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 opacity-30 group-hover:opacity-70 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="m6 3 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="mt-1 flex items-end justify-between gap-3">
              {v.value == null ? (
                <span className="fig text-3xl text-muted">–</span>
              ) : (
                <span className="flex items-baseline gap-1.5">
                  <span className="fig text-[2.25rem] leading-none font-semibold text-ink">
                    <CountUp value={v.value} format={v.format} delay={0.2 + i * 0.08} />
                  </span>
                  {v.unit && <span className="text-sm text-muted">{v.unit}</span>}
                </span>
              )}
              <Spark rows={data.trends} k={v.key} date={data.date} color={v.color} />
            </span>
            <span className="block mt-1.5 text-[13px] leading-snug text-ink-2">{EXPLAIN[v.key].short}</span>
            {v.note && <span className={`block mt-1 text-[13px] ${v.good === true ? 'text-move' : v.good === false ? 'text-heart' : 'text-muted'}`}>{v.note}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

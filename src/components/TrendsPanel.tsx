'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { DashboardData } from '../types/dashboard';
import { dur, shortDate, signed, tempDelta } from '../lib/format';

export type TrendKey = 'sleepMinutes' | 'restingHr' | 'hrv' | 'steps' | 'azm' | 'spo2' | 'respRate' | 'skinTempDevC';
interface Metric {
  key: TrendKey;
  name: string;
  color: string;
  bars: boolean;
  fmt: (v: number) => string;
}

const W = 1000;
const H = 220;

interface Props {
  data: DashboardData;
  metric: TrendKey;
  onMetric: (k: TrendKey) => void;
  onDate: (d: string) => void;
}

export function TrendsPanel({ data, metric: key, onMetric: setKey, onDate }: Props) {
  const reduce = useReducedMotion();
  const t = data.units.temperature;
  const metrics: Metric[] = [
    { key: 'sleepMinutes', name: 'Sleep', color: 'var(--sleep)', bars: true, fmt: dur },
    { key: 'restingHr', name: 'Resting heart rate', color: 'var(--heart)', bars: false, fmt: (v) => `${Math.round(v)} bpm` },
    { key: 'hrv', name: 'HRV', color: 'var(--rem)', bars: false, fmt: (v) => `${Math.round(v)} ms` },
    { key: 'steps', name: 'Steps', color: 'var(--move)', bars: true, fmt: (v) => Math.round(v).toLocaleString() },
    { key: 'azm', name: 'Zone minutes', color: 'var(--awake)', bars: true, fmt: (v) => `${Math.round(v)} min` },
    { key: 'spo2', name: 'Blood oxygen', color: 'var(--breath)', bars: false, fmt: (v) => `${v.toFixed(1)}%` },
    { key: 'respRate', name: 'Breathing', color: 'var(--breath)', bars: false, fmt: (v) => `${v.toFixed(1)}/min` },
    { key: 'skinTempDevC', name: 'Skin temperature', color: 'var(--awake)', bars: false, fmt: (v) => `${signed(tempDelta(v, t), 1)}°${t}` },
  ];
  const [hover, setHover] = useState<number | null>(null);
  const m = metrics.find((x) => x.key === key)!;

  const rows = data.trends;
  const vals = rows.map((r) => r[key]);
  const have = vals.filter((v): v is number => v != null);
  const mean = have.length ? have.reduce((a, b) => a + b, 0) / have.length : null;
  const lo = m.bars ? 0 : have.length ? Math.min(...have) : 0;
  const hi = have.length ? Math.max(...have) : 1;
  const pad = m.bars ? hi * 0.1 : (hi - lo) * 0.2 || 1;
  const y = (v: number) => H - ((v - (lo - (m.bars ? 0 : pad))) / (hi + pad - (lo - (m.bars ? 0 : pad)) || 1)) * H;
  const step = W / rows.length;
  const cx = (i: number) => step * i + step / 2;

  let line = '';
  vals.forEach((v, i) => {
    if (v == null) return;
    line += `${i > 0 && vals[i - 1] != null ? 'L' : 'M'}${cx(i)},${y(v)} `;
  });

  const focus = hover ?? rows.findIndex((r) => r.date === data.date);
  const focusRow = rows[focus];
  const label = shortDate;

  return (
    <section id="trends" className="panel p-6 sm:p-8 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {data.bandSince && rows.length < 30 ? `Since you put the band on, ${label(data.bandSince)}` : 'Last 30 days'}
          </h2>
          <p className="mt-1 text-ink-2">
            {have.length === 0
              ? `No ${m.name.toLowerCase()} recorded in this period yet.`
              : `${m.name} on ${have.length} of ${rows.length} days, averaging ${m.fmt(mean!)}. Pick a day to open it.`}
          </p>
        </div>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Measurement">
        {metrics.map((x) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={key === x.key}
            onClick={() => setKey(x.key)}
            className={`relative shrink-0 h-9 px-4 rounded-full text-sm transition-colors ${key === x.key ? 'text-ink' : 'text-ink-2 hover:text-ink'}`}
          >
            {key === x.key && <motion.span layoutId="metric-pill" className="absolute inset-0 rounded-full bg-surface-2" style={{ boxShadow: `inset 0 0 0 1.5px ${x.color}` }} transition={{ type: 'spring', stiffness: 450, damping: 35 }} />}
            <span className="relative flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: x.color }} />
              {x.name}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-baseline gap-3 min-h-10" aria-live="polite">
        {focusRow && focusRow[key] != null ? (
          <>
            <span className="fig text-4xl font-semibold" style={{ color: m.color }}>{m.fmt(focusRow[key]!)}</span>
            <span className="text-ink-2">{label(focusRow.date)}</span>
          </>
        ) : (
          <span className="text-muted">{focusRow ? `Nothing recorded on ${label(focusRow.date)}` : ''}</span>
        )}
      </div>

      <div className="mt-4 relative" style={{ height: H }} onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible" role="img" aria-label={`${m.name} by day`}>
          <line x1={0} x2={W} y1={H} y2={H} stroke="var(--line)" vectorEffect="non-scaling-stroke" />
          {mean != null && have.length > 1 && (
            <line x1={0} x2={W} y1={y(mean)} y2={y(mean)} stroke={m.color} strokeOpacity={0.5} strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
          )}
          <AnimatePresence mode="popLayout">
            <motion.g key={key} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {m.bars
                ? vals.map((v, i) =>
                    v == null ? null : (
                      <motion.rect
                        key={i}
                        x={cx(i) - step * 0.32}
                        width={step * 0.64}
                        rx={Math.min(step * 0.15, 6)}
                        fill={m.color}
                        opacity={i === focus ? 1 : 0.45}
                        initial={reduce ? false : { y: H, height: 0 }}
                        animate={{ y: y(v), height: H - y(v) }}
                        transition={{ duration: 0.6, delay: i * (0.4 / rows.length), ease: [0.16, 1, 0.3, 1] }}
                      />
                    )
                  )
                : (
                  <>
                    <motion.path
                      d={line}
                      fill="none"
                      stroke={m.color}
                      strokeWidth={2.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      initial={reduce ? false : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
                    />
                  </>
                )}
            </motion.g>
          </AnimatePresence>
          {focus >= 0 && <line x1={cx(focus)} x2={cx(focus)} y1={0} y2={H} stroke="var(--ink)" strokeOpacity={0.25} vectorEffect="non-scaling-stroke" />}
        </svg>
        {/* Dots in HTML so they stay round at any width */}
        {!m.bars &&
          vals.map((v, i) =>
            v == null ? null : (
              <span
                key={`${key}-${i}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none transition-all"
                style={{
                  left: `${(cx(i) / W) * 100}%`,
                  top: `${(y(v) / H) * 100}%`,
                  width: i === focus ? 12 : 8,
                  height: i === focus ? 12 : 8,
                  background: i === focus ? m.color : 'var(--surface)',
                  boxShadow: `0 0 0 2px ${m.color}`,
                }}
              />
            )
          )}
        <div className="absolute inset-0 flex">
          {rows.map((r, i) => (
            <button
              key={r.date}
              className="flex-1 h-full cursor-pointer rounded-lg"
              aria-label={`${label(r.date)}: ${r[key] != null ? m.fmt(r[key]!) : 'no data'}. Open this day`}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => onDate(r.date)}
            />
          ))}
        </div>
      </div>
      <div className="relative h-6 mt-2 text-xs text-muted fig" aria-hidden>
        {rows.map((r, i) =>
          rows.length <= 10 || i % 5 === 0 || i === rows.length - 1 ? (
            <span key={r.date} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(cx(i) / W) * 100}%` }}>
              {label(r.date)}
            </span>
          ) : null
        )}
      </div>
    </section>
  );
}

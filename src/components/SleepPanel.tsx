'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { SleepStageInterval, SleepSummary } from '../types/dashboard';
import { dur, toMin } from '../lib/format';
import { STAGE_COLOR, STAGE_NAME } from './BodyClock';
import { STAGE_HINT } from './explain';

const ORDER: SleepStageInterval['stage'][] = ['wake', 'rem', 'light', 'deep'];
const W = 1000;
const LANE = 40;
const H = LANE * ORDER.length;

export function SleepPanel({ sleep, avgNights, title }: { sleep: SleepSummary; avgNights?: number; title: string }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);

  const ends = sleep.stages.reduce<number[]>((acc, s) => [...acc, (acc.at(-1) ?? 0) + s.durationMinutes], []);
  const total = ends.at(-1) || 1;
  const segs = sleep.stages.map((s, i) => ({
    s,
    x0: ((ends[i] - s.durationMinutes) / total) * W,
    x1: (ends[i] / total) * W,
    lane: ORDER.indexOf(s.stage),
  }));
  const mid = (lane: number) => lane * LANE + LANE / 2;
  const step = segs.map((g, i) => `${i ? 'L' : 'M'}${g.x0},${mid(g.lane)} L${g.x1},${mid(g.lane)}`).join(' ');

  const start = toMin(sleep.bedtime);
  const ticks: { x: number; label: string }[] = [];
  for (let m = Math.ceil(start / 60) * 60; m - start <= total; m += 60) {
    const x = ((m - start) / total) * 100;
    if (x > 4 && x < 96) ticks.push({ x, label: String(Math.floor(m / 60) % 24).padStart(2, '0') + ':00' });
  }

  const totals = [
    { stage: 'deep' as const, min: sleep.deepMinutes },
    { stage: 'light' as const, min: sleep.lightMinutes },
    { stage: 'rem' as const, min: sleep.remMinutes },
    { stage: 'wake' as const, min: sleep.wakeMinutes },
  ];
  const all = totals.reduce((a, t) => a + t.min, 0) || 1;
  const diff = sleep.baselineDiffMinutes;
  const h = hover != null ? segs[hover] : null;

  return (
    <section className="panel p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-ink-2">
            Asleep {dur(sleep.totalSleepMinutes)} between {sleep.bedtime} and {sleep.wakeTime}, {sleep.efficiency}% of your time in bed.
            {avgNights ? ` That's ${dur(Math.abs(diff))} ${diff >= 0 ? 'more' : 'less'} than your ${avgNights}-night average.` : ''}
          </p>
        </div>
        <p className="text-sm text-muted min-h-5" aria-live="polite">
          {h ? `${STAGE_NAME[h.s.stage]}, ${h.s.startTime}–${h.s.endTime} (${dur(h.s.durationMinutes)})` : `${sleep.restlessEventsCount} short awakenings`}
        </p>
      </div>

      <div className="mt-8 grid grid-cols-[4.5rem_1fr] gap-x-3">
        <div aria-hidden>
          {ORDER.map((s) => (
            <div key={s} className="text-[13px] text-ink-2 flex items-center" style={{ height: LANE }}>
              {s === 'wake' ? 'Awake' : s === 'rem' ? 'REM' : s === 'light' ? 'Light' : 'Deep'}
            </div>
          ))}
        </div>
        <div className="min-w-0">
          <div className="relative rounded-xl bg-surface-2 overflow-hidden">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height: H }} role="img" aria-label="Sleep stages through the night">
              <defs>
                <clipPath id="sleep-reveal">
                  <motion.rect
                    key={sleep.date}
                    x={0}
                    y={0}
                    height={H}
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: W }}
                    transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
                    width={W}
                  />
                </clipPath>
              </defs>
              <g clipPath="url(#sleep-reveal)">
                {segs.map((g, i) => (
                  <rect
                    key={i}
                    x={g.x0}
                    y={g.lane * LANE + 8}
                    width={Math.max(g.x1 - g.x0, 1)}
                    height={LANE - 16}
                    rx={4}
                    fill={STAGE_COLOR[g.s.stage]}
                    opacity={hover != null && hover !== i ? 0.35 : 1}
                    onPointerEnter={() => setHover(i)}
                    onPointerLeave={() => setHover(null)}
                    style={{ transition: 'opacity .2s' }}
                  />
                ))}
                <path d={step} fill="none" stroke="var(--ink)" strokeOpacity={0.35} strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />
              </g>
            </svg>
          </div>
          <div className="relative h-6 mt-2 text-xs text-muted fig" aria-hidden>
            {ticks.map((t, i) => (
              // Phones: every other hour, so the labels don't run into each other.
              <span key={t.x} className={`absolute -translate-x-1/2 ${i % 2 ? 'hidden sm:inline' : ''}`} style={{ left: `${t.x}%` }}>
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex h-3 rounded-full overflow-hidden gap-[3px]">
        {totals.map((t, i) => (
          <motion.span
            key={t.stage}
            className="h-full rounded-full"
            style={{ background: STAGE_COLOR[t.stage] }}
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${(t.min / all) * 100}%` }}
            transition={{ duration: 0.8, delay: 0.3 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
      </div>
      <dl className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-5">
        {totals.map((t) => (
          <div key={t.stage}>
            <dt className="text-sm text-ink-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: STAGE_COLOR[t.stage] }} />
              {STAGE_NAME[t.stage]}
            </dt>
            <dd className="mt-1 flex items-baseline gap-2">
              <span className="fig text-2xl font-semibold">{dur(t.min)}</span>
              <span className="text-sm text-muted">{Math.round((t.min / all) * 100)}%</span>
            </dd>
            <dd className="mt-1 text-[13px] leading-snug text-muted">{STAGE_HINT[t.stage]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

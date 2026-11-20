'use client';

import { useCallback } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { DashboardData } from '../types/dashboard';
import { distance, dur } from '../lib/format';
import { CountUp } from './CountUp';
import { EXPLAIN } from './explain';

export function ActivityPanel({ data }: { data: DashboardData }) {
  const reduce = useReducedMotion();
  const d = data.day;
  const avg = data.averages.steps;
  const isToday = data.date === data.today;
  const fmtInt = useCallback((v: number) => Math.round(v).toLocaleString(), []);
  const stepsPct = d.steps != null && avg ? Math.min(d.steps / avg.value, 1.6) : null;
  const azm = d.azm;
  const zoneRange = (type: string) => {
    const z = d.hrZones.find((x) => x.type === type);
    return z ? (type === 'PEAK' ? `${z.min}+ bpm` : `${z.min}–${z.max} bpm`) : '';
  };

  return (
    <section className="panel p-6 sm:p-8 flex flex-col">
      <h2 className="font-display text-2xl font-semibold tracking-tight">{isToday ? 'Moving today' : 'Moving that day'}</h2>

      <div className="mt-6">
        <p className="text-sm text-ink-2">Steps</p>
        <p className="fig text-5xl font-semibold mt-1">{d.steps != null ? <CountUp value={d.steps} format={fmtInt} delay={0.3} /> : '–'}</p>
        {stepsPct != null && avg && (
          <div className="mt-3">
            <div className="relative h-2 rounded-full bg-surface-2">
              <motion.div
                key={data.date}
                className="absolute inset-y-0 left-0 rounded-full bg-move"
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${(stepsPct / 1.6) * 100}%` }}
                transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              />
              <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-ink" style={{ left: `${(1 / 1.6) * 100}%` }} title="Your average" />
            </div>
            <p className="mt-2 text-[13px] text-muted">
              The mark is your average of {Math.round(avg.value).toLocaleString()} steps a day, over {avg.days} full days with the band.
            </p>
          </div>
        )}
      </div>

      {d.caloriesKcal != null && (
        <div
          className="mt-6 rounded-2xl p-5"
          style={{ background: 'radial-gradient(130% 130% at 0% 0%, color-mix(in oklab, var(--awake) 20%, transparent), transparent 65%), var(--surface-2)' }}
        >
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 shrink-0 rounded-full grid place-items-center bg-surface" aria-hidden>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="var(--awake)">
                <path d="M12 2c.6 3.2-1.4 4.9-3 6.7C7.4 10.4 6 12.2 6 14.8A6 6 0 0 0 18 15c0-2.6-1.2-4.5-2.6-6-.2 1.6-.9 2.7-2 3.2.5-3.6-.3-7.4-1.4-10.2Z" />
              </svg>
            </span>
            <div>
              <p className="text-sm text-ink-2">Calories burned</p>
              <p className="flex items-baseline gap-1.5">
                <span className="fig text-3xl font-semibold text-ink">
                  <CountUp value={d.caloriesKcal} format={fmtInt} delay={0.4} />
                </span>
                <span className="text-sm text-muted">kcal</span>
              </p>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
            All the energy your body used {isToday ? 'so far today' : 'that day'}: breathing, thinking and digesting, plus moving. Most of it burns even at rest.
          </p>
        </div>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm text-ink-2">Distance</dt>
          <dd className="fig text-2xl font-semibold mt-1">{d.distanceMm != null ? distance(d.distanceMm, data.units.distance) : '–'}</dd>
        </div>
        {d.napMinutes > 0 && (
          <div>
            <dt className="text-sm text-ink-2">Naps</dt>
            <dd className="fig text-2xl font-semibold mt-1">{dur(d.napMinutes)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-auto pt-8">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-ink-2">Active zone minutes</p>
          <p className="fig text-2xl font-semibold">{azm ? azm.total : '–'}</p>
        </div>
        <p className="mt-1 text-[13px] leading-snug text-muted">{EXPLAIN.azm.short}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { name: 'Fat burn', v: azm?.fatBurn ?? 0, type: 'MODERATE', color: 'var(--awake)', like: 'Like a brisk walk' },
            { name: 'Cardio', v: azm?.cardio ?? 0, type: 'VIGOROUS', color: 'var(--heart)', like: 'Like a jog or run' },
            { name: 'Peak', v: azm?.peak ?? 0, type: 'PEAK', color: 'var(--rem)', like: 'Like a sprint' },
          ].map((z) => (
            <div key={z.name} className="rounded-2xl bg-surface-2 p-3">
              <p className="text-[13px] text-ink-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: z.color }} />
                {z.name}
              </p>
              <p className="fig text-xl font-semibold mt-1">{z.v}</p>
              <p className="mt-1 text-[12px] leading-snug text-ink-2">{z.like}</p>
              <p className="text-[11px] text-muted">{zoneRange(z.type)}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-muted">Minutes in cardio and peak count double.</p>
      </div>
    </section>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import type { DashboardData } from '../types/dashboard';
import { dur } from '../lib/format';

// One chip per day the band has been worn. The little ring fills with that night's sleep (full = 9 h).
export function DayStrip({ data, onDate }: { data: DashboardData; onDate: (d: string) => void }) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-current="date"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [data.date]);

  const R = 11;
  const CIRC = 2 * Math.PI * R;

  return (
    <div ref={listRef} className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none]" role="group" aria-label="Choose a day">
      {data.trends.map((r) => {
        const active = r.date === data.date;
        const d = new Date(`${r.date}T00:00:00Z`);
        const wd = r.date === data.today ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
        const frac = r.sleepMinutes ? Math.min(r.sleepMinutes / 540, 1) : 0;
        return (
          <button
            key={r.date}
            onClick={() => onDate(r.date)}
            aria-current={active ? 'date' : undefined}
            aria-label={`${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}${r.sleepMinutes ? `, slept ${dur(r.sleepMinutes)}` : ''}`}
            className={`group relative shrink-0 w-[4.25rem] rounded-2xl pt-2.5 pb-2 flex flex-col items-center gap-1 transition-colors ${active ? 'text-bg' : 'text-ink-2 hover:text-ink hover:bg-surface'}`}
          >
            {active && <motion.span layoutId="day-pill" className="absolute inset-0 rounded-2xl bg-ink" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative text-xs">{wd}</span>
            <span className="relative fig text-lg font-semibold leading-none">{d.getUTCDate()}</span>
            <svg viewBox="0 0 28 28" className="relative w-7 h-7 -rotate-90" aria-hidden>
              <circle cx="14" cy="14" r={R} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth="3" />
              {frac > 0 && (
                <motion.circle
                  cx="14"
                  cy="14"
                  r={R}
                  fill="none"
                  stroke={active ? 'var(--light-sleep)' : 'var(--sleep)'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  initial={{ strokeDashoffset: CIRC }}
                  animate={{ strokeDashoffset: CIRC * (1 - frac) }}
                  transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
            </svg>
          </button>
        );
      })}
    </div>
  );
}

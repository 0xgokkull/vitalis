'use client';

import { useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Exercise, HrBucket, HrZone, SleepSummary } from '../types/dashboard';
import { toMin } from '../lib/format';

interface Props {
  date: string;
  data: HrBucket[];
  zones: HrZone[];
  restingHr: number | null;
  sleep: SleepSummary | null;
  exercises: Exercise[];
}

const W = 1000;
const H = 240;
const DAY = 1440;
const ZONE_NAME: Record<string, string> = { MODERATE: 'Fat burn', VIGOROUS: 'Cardio', PEAK: 'Peak' };

export function HeartPanel({ date, data, zones, restingHr, sleep, exercises }: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<(HrBucket & { m: number }) | null>(null);

  const pts = useMemo(() => data.map((d) => ({ ...d, m: toMin(d.time) })), [data]);
  const lo = pts.length ? Math.min(...pts.map((p) => p.min)) : 40;
  const hi = pts.length ? Math.max(...pts.map((p) => p.max)) : 120;
  const yMin = Math.floor((lo - 5) / 10) * 10;
  const yMax = Math.ceil((hi + 5) / 10) * 10;
  const x = (m: number) => (m / DAY) * W;
  const y = (v: number) => H - ((v - yMin) / (yMax - yMin)) * H;

  const runs: (typeof pts)[] = [];
  pts.forEach((p, i) => {
    if (i === 0 || p.m - pts[i - 1].m > 10) runs.push([]);
    runs[runs.length - 1].push(p);
  });
  const line = runs.map((r) => r.map((p, i) => `${i ? 'L' : 'M'}${x(p.m)},${y(p.avg)}`).join(' ')).join(' ');
  const area = runs
    .filter((r) => r.length > 1)
    .map((r) => `M${x(r[0].m)},${H} ${r.map((p) => `L${x(p.m)},${y(p.avg)}`).join(' ')} L${x(r[r.length - 1].m)},${H} Z`)
    .join(' ');

  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax; v += yMax - yMin > 80 ? 20 : 10) yTicks.push(v);
  const sleepSpan = sleep ? { from: toMin(sleep.bedtime) > toMin(sleep.wakeTime) ? 0 : toMin(sleep.bedtime), to: toMin(sleep.wakeTime) } : null;
  const zoneLines = zones.filter((z) => z.type !== 'LIGHT' && z.min > yMin && z.min < yMax);
  const low = pts.length ? pts.reduce((a, p) => (p.min < a.min ? p : a)) : null;
  const high = pts.length ? pts.reduce((a, p) => (p.max > a.max ? p : a)) : null;

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !pts.length) return;
    const m = ((e.clientX - r.left) / r.width) * DAY;
    const best = pts.reduce((b, p) => (Math.abs(p.m - m) < Math.abs(b.m - m) ? p : b));
    setHover(Math.abs(best.m - m) <= 15 ? best : null);
  };

  return (
    <section className="panel p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Heart through the day</h2>
          <p className="mt-1 text-ink-2">
            {pts.length >= 12 && low && high
              ? `Lowest ${low.min} bpm at ${low.time}, highest ${high.max} bpm at ${high.time}.`
              : pts.length
                ? `Only ${pts.length * 5} minutes recorded so far. The chart fills in as the band syncs through the day.`
                : 'No heart rate recorded for this day.'}
          </p>
        </div>
        <p className="text-sm text-muted min-h-5" aria-live="polite">
          {hover ? (
            <>
              <span className="fig text-ink font-semibold">{hover.time}</span>, {hover.avg} bpm average (range {hover.min}–{hover.max})
            </>
          ) : restingHr != null ? (
            `Resting rate ${restingHr} bpm`
          ) : null}
        </p>
      </div>

      {pts.length >= 12 && (
        <div className="mt-8 grid grid-cols-[2.25rem_1fr] gap-x-2">
          <div className="relative" style={{ height: H }} aria-hidden>
            {yTicks.map((v) => (
              <span key={v} className="absolute right-0 -translate-y-1/2 text-xs text-muted fig" style={{ top: `${(y(v) / H) * 100}%` }}>
                {v}
              </span>
            ))}
          </div>
          <div className="min-w-0">
            <div ref={ref} className="relative cursor-crosshair touch-none" style={{ height: H }} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full" role="img" aria-label="Heart rate through the day">
                <defs>
                  <linearGradient id="hr-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--heart)" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="var(--heart)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {sleepSpan && <rect x={x(sleepSpan.from)} width={x(sleepSpan.to - sleepSpan.from)} y={0} height={H} rx={8} fill="var(--sleep)" opacity={0.08} />}
                {exercises.map((e, i) => (
                  <rect key={i} x={x(toMin(e.start))} width={Math.max(x(toMin(e.end) - toMin(e.start)), 3)} y={0} height={H} rx={6} fill="var(--move)" opacity={0.14} />
                ))}
                {yTicks.map((v) => (
                  <line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="var(--line)" vectorEffect="non-scaling-stroke" />
                ))}
                {zoneLines.map((z) => (
                  <line key={z.type} x1={0} x2={W} y1={y(z.min)} y2={y(z.min)} stroke="var(--awake)" strokeDasharray="2 6" strokeWidth={1.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                ))}
                {restingHr != null && (
                  <line x1={0} x2={W} y1={y(restingHr)} y2={y(restingHr)} stroke="var(--heart)" strokeDasharray="6 5" strokeOpacity={0.6} vectorEffect="non-scaling-stroke" />
                )}
                <motion.path key={`a-${date}`} d={area} fill="url(#hr-fill)" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.6 }} />
                <motion.path
                  key={`l-${date}`}
                  d={line}
                  fill="none"
                  stroke="var(--heart)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.4, ease: [0.65, 0, 0.35, 1] }}
                />
                {hover && <line x1={x(hover.m)} x2={x(hover.m)} y1={0} y2={H} stroke="var(--ink)" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />}
              </svg>
              {sleepSpan && sleepSpan.to - sleepSpan.from > 120 && (
                <span className="absolute top-2 text-xs text-sleep" style={{ left: `calc(${(sleepSpan.from / DAY) * 100}% + 10px)` }}>
                  Asleep
                </span>
              )}
              {exercises.map((e, i) => (
                <span key={i} className="absolute top-2 text-xs text-move whitespace-nowrap" style={{ left: `calc(${(toMin(e.start) / DAY) * 100}% + 4px)` }}>
                  {e.name}
                </span>
              ))}
              {hover && (
                <motion.span
                  layout
                  className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-heart ring-[3px] ring-surface pointer-events-none"
                  style={{ left: `${(hover.m / DAY) * 100}%`, top: `${(y(hover.avg) / H) * 100}%` }}
                />
              )}
            </div>
            <div className="relative h-6 mt-2 text-xs text-muted fig" aria-hidden>
              {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((hr) => (
                <span
                  key={hr}
                  className={`absolute ${hr % 6 ? 'hidden sm:inline' : ''} ${hr === 0 ? '' : hr === 24 ? '-translate-x-full' : '-translate-x-1/2'}`}
                  style={{ left: `${(hr / 24) * 100}%` }}
                >
                  {String(hr % 24).padStart(2, '0')}:00
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-2">
        {restingHr != null && (
          <span className="flex items-center gap-2">
            <span className="w-4 border-t-2 border-dashed border-heart opacity-70" />
            Resting {restingHr} bpm
          </span>
        )}
        {zoneLines.map((z) => (
          <span key={z.type} className="flex items-center gap-2">
            <span className="w-4 border-t-2 border-dotted border-awake" />
            {ZONE_NAME[z.type]} zone from {z.min} bpm
          </span>
        ))}
      </div>

      {exercises.length > 0 && (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {exercises.map((e, i) => (
            <li key={i} className="rounded-2xl bg-surface-2 p-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div>
                <p className="font-display font-semibold text-lg">{e.name}</p>
                <p className="text-sm text-ink-2">
                  {e.start}–{e.end}, {e.activeMinutes} minutes
                </p>
              </div>
              <p className="text-sm text-ink-2 text-right">
                {e.avgHr != null && <>Average {e.avgHr} bpm<br /></>}
                {[e.azm != null && `${e.azm} zone min`, e.kcal != null && `${e.kcal} kcal`].filter(Boolean).join(', ')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

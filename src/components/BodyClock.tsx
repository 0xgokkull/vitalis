'use client';

import { useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { DashboardData, SleepStageInterval } from '../types/dashboard';
import { dur, toMin } from '../lib/format';

const S = 480;
const C = S / 2;
const R_SLEEP = 186;
const R_WORK = 162;
const R_HR_IN = 74;
const R_HR_OUT = 150;
const R_CORE = 64;

export const STAGE_COLOR: Record<SleepStageInterval['stage'], string> = {
  deep: 'var(--deep)',
  light: 'var(--light-sleep)',
  rem: 'var(--rem)',
  wake: 'var(--awake)',
};
export const STAGE_NAME: Record<SleepStageInterval['stage'], string> = {
  deep: 'Deep sleep',
  light: 'Light sleep',
  rem: 'REM sleep',
  wake: 'Awake',
};

const ang = (m: number) => (m / 1440) * Math.PI * 2 - Math.PI / 2;
const pt = (r: number, m: number) => [C + r * Math.cos(ang(m)), C + r * Math.sin(ang(m))] as const;

function arc(r: number, m0: number, m1: number) {
  let end = m1;
  if (end <= m0) end += 1440;
  const [x0, y0] = pt(r, m0);
  const [x1, y1] = pt(r, end);
  return `M${x0},${y0} A${r},${r} 0 ${end - m0 > 720 ? 1 : 0} 1 ${x1},${y1}`;
}

interface Props {
  data: DashboardData;
  nowMin: number | null; // minutes since local midnight, only for today
}

export function BodyClock({ data, nowMin }: Props) {
  const reduce = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverMin, setHoverMin] = useState<number | null>(null);
  const day = data.day;

  const stages = useMemo(
    () =>
      (day.sleep?.stages ?? []).map((s) => {
        const a = toMin(s.startTime);
        let b = toMin(s.endTime);
        if (b <= a) b += 1440;
        return { ...s, a, b };
      }),
    [day.sleep]
  );

  const hr = useMemo(() => day.heartRate.map((h) => ({ ...h, m: toMin(h.time) })), [day.heartRate]);
  const lo = hr.length ? Math.min(...hr.map((h) => h.avg)) : 50;
  const hi = hr.length ? Math.max(...hr.map((h) => h.avg)) : 120;
  const rOf = (bpm: number) => R_HR_IN + ((bpm - lo) / Math.max(hi - lo, 1)) * (R_HR_OUT - R_HR_IN);

  // Heart trace as polar runs; break where the band wasn't worn.
  const runs = useMemo(() => {
    const out: (typeof hr)[] = [];
    hr.forEach((h, i) => {
      if (i === 0 || h.m - hr[i - 1].m > 10) out.push([]);
      out[out.length - 1].push(h);
    });
    return out.filter((r) => r.length > 1);
  }, [hr]);
  const tracePath = (run: typeof hr) => run.map((h, i) => `${i ? 'L' : 'M'}${pt(rOf(h.avg), h.m).join(',')}`).join(' ');
  const areaPath = (run: typeof hr) => {
    const first = run[0].m;
    const last = run[run.length - 1].m;
    const [bx, by] = pt(R_HR_IN, last);
    const [ex, ey] = pt(R_HR_IN, first);
    return `${tracePath(run)} L${bx},${by} A${R_HR_IN},${R_HR_IN} 0 ${last - first > 720 ? 1 : 0} 0 ${ex},${ey} Z`;
  };

  const workouts = day.exercises.map((e) => ({ ...e, a: toMin(e.start), b: toMin(e.end) }));

  // Hover readout
  const inRange = (m: number, a: number, b: number) => (m >= a && m < b) || (m + 1440 >= a && m + 1440 < b);
  const focus = hoverMin ?? (nowMin != null ? nowMin : hr.length ? hr[hr.length - 1].m : null);
  const focusHr = focus != null ? hr.reduce<(typeof hr)[number] | null>((best, h) => (Math.abs(h.m - focus) <= 10 && (!best || Math.abs(h.m - focus) < Math.abs(best.m - focus)) ? h : best), null) : null;
  const focusStage = focus != null ? stages.find((s) => inRange(focus, s.a, s.b)) : undefined;
  const focusWork = focus != null ? workouts.find((w) => inRange(focus, w.a, w.b)) : undefined;
  const latest = hr.length ? hr[hr.length - 1] : null;
  const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

  const onMove = (e: React.PointerEvent) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * S - C;
    const y = ((e.clientY - r.top) / r.height) * S - C;
    const dist = Math.hypot(x, y);
    if (dist < R_CORE || dist > R_SLEEP + 20) return setHoverMin(null);
    const m = (((Math.atan2(y, x) + Math.PI / 2) / (Math.PI * 2)) * 1440 + 1440) % 1440;
    setHoverMin(Math.round(m / 5) * 5);
  };

  const draw = (delay: number, duration = 1) =>
    reduce
      ? {}
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { pathLength: { delay, duration, ease: [0.65, 0, 0.35, 1] as const }, opacity: { delay, duration: 0.01 } },
        };

  return (
    <figure className="relative w-full max-w-[520px] mx-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${S} ${S}`}
        className="w-full h-auto touch-none select-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHoverMin(null)}
        role="img"
        aria-label={`24-hour view of ${data.date}: sleep stages around the night, heart rate inside, workouts on the inner ring`}
      >
        {/* Track rings */}
        <circle cx={C} cy={C} r={R_SLEEP} fill="none" stroke="var(--surface-2)" strokeWidth={22} />
        <circle cx={C} cy={C} r={R_WORK} fill="none" stroke="var(--surface-2)" strokeWidth={8} />
        <circle cx={C} cy={C} r={R_HR_IN} fill="none" stroke="var(--line)" strokeWidth={1} />

        {/* Hour ticks and labels */}
        {Array.from({ length: 24 }, (_, h) => {
          const major = h % 6 === 0;
          const [x0, y0] = pt(major ? 202 : 204, h * 60);
          const [x1, y1] = pt(210, h * 60);
          const [lx, ly] = pt(226, h * 60);
          return (
            <g key={h}>
              <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={major ? 'var(--ink-2)' : 'var(--muted)'} strokeWidth={major ? 1.5 : 1} opacity={major ? 1 : 0.6} />
              {h % 3 === 0 && (
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize={major ? 14 : 11} fill={major ? 'var(--ink-2)' : 'var(--muted)'} className="fig">
                  {String(h).padStart(2, '0')}
                </text>
              )}
            </g>
          );
        })}

        <g key={`d-${data.date}`}>
          {/* Sleep stages around the night */}
          {stages.map((s, i) => (
            <motion.path
              key={i}
              d={arc(R_SLEEP, s.a, s.b)}
              fill="none"
              stroke={STAGE_COLOR[s.stage]}
              strokeWidth={22}
              opacity={focusStage && hoverMin != null && focusStage !== s ? 0.45 : 1}
              {...draw(0.15 + (i / Math.max(stages.length, 1)) * 0.9, 0.25)}
            />
          ))}

          {/* Workouts */}
          {workouts.map((w, i) => (
            <motion.path key={i} d={arc(R_WORK, w.a, Math.max(w.b, w.a + 6))} fill="none" stroke="var(--move)" strokeWidth={8} strokeLinecap="round" {...draw(1.1, 0.6)} />
          ))}

          {/* Resting heart rate reference */}
          {day.restingHr != null && day.restingHr >= lo && day.restingHr <= hi && (
            <circle cx={C} cy={C} r={rOf(day.restingHr)} fill="none" stroke="var(--heart)" strokeWidth={1} strokeDasharray="2 5" opacity={0.5} />
          )}

          {/* Heart rate trace */}
          {runs.map((run, i) => (
            <g key={i}>
              <motion.path
                d={areaPath(run)}
                fill="var(--heart)"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 0.1 }}
                transition={{ delay: 1.5, duration: 0.8 }}
              />
              <motion.path d={tracePath(run)} fill="none" stroke="var(--heart)" strokeWidth={1.6} strokeLinejoin="round" {...draw(0.5, 1.4)} />
            </g>
          ))}
        </g>

        {/* Hand: hovered time, or now */}
        {focus != null && (hoverMin != null || nowMin != null) && (
          <g pointerEvents="none">
            <line
              x1={pt(R_CORE, focus)[0]}
              y1={pt(R_CORE, focus)[1]}
              x2={pt(R_SLEEP + 14, focus)[0]}
              y2={pt(R_SLEEP + 14, focus)[1]}
              stroke="var(--ink)"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            {focusHr && <circle cx={pt(rOf(focusHr.avg), focusHr.m)[0]} cy={pt(rOf(focusHr.avg), focusHr.m)[1]} r={4.5} fill="var(--heart)" stroke="var(--surface)" strokeWidth={2} />}
          </g>
        )}

        <circle cx={C} cy={C} r={R_CORE} fill="var(--surface)" />
      </svg>

      {/* Centre readout */}
      <div className="absolute inset-0 grid place-items-center pointer-events-none" aria-live="polite">
        <div className="text-center w-[26%]">
          {focus != null ? (
            <>
              <div className="fig text-[clamp(1.1rem,3.6vw,1.6rem)] font-semibold text-ink leading-none">{clock(focus)}</div>
              <div className="mt-1 text-[clamp(0.6rem,1.8vw,0.75rem)] leading-tight text-ink-2">
                {focusHr ? `${focusHr.avg} bpm` : latest && hoverMin == null ? `${latest.avg} bpm` : 'No reading'}
                <br />
                <span className="text-muted">
                  {focusWork ? focusWork.name : focusStage ? STAGE_NAME[focusStage.stage] : !focusHr && latest && hoverMin == null ? `last at ${latest.time}` : hoverMin == null && nowMin != null ? 'Now' : ''}
                </span>
              </div>
            </>
          ) : (
            <div className="text-xs text-muted">No data</div>
          )}
        </div>
      </div>

      <figcaption className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-ink-2">
        {(['deep', 'light', 'rem', 'wake'] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: STAGE_COLOR[s] }} />
            {STAGE_NAME[s]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded-full bg-heart" />
          Heart rate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-full bg-move" />
          Workout
        </span>
        {day.sleep && <span className="text-muted">Asleep {dur(day.sleep.totalSleepMinutes)}</span>}
      </figcaption>
    </figure>
  );
}

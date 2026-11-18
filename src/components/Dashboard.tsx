'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import type { DashboardData } from '../types/dashboard';
import { TopBar } from './TopBar';
import { Hero } from './Hero';
import { BodyClock } from './BodyClock';
import { SleepPanel } from './SleepPanel';
import { HeartPanel } from './HeartPanel';
import { ActivityPanel } from './ActivityPanel';
import { TrendsPanel, type TrendKey } from './TrendsPanel';
import { shiftDate } from '../lib/format';
import { CoachCard, CoachDrawer, CoachLauncher } from './Coach';


// Minutes since midnight in the wearer's time zone.
function minutesIn(tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );
  return Number(p.hour) * 60 + Number(p.minute);
}

export function Dashboard() {
  const [date, setDate] = useState<string | undefined>(undefined);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nowMin, setNowMin] = useState<number | null>(null);
  const [metric, setMetric] = useState<TrendKey>('sleepMinutes');
  const loadedAt = useRef(0);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachAsk, setCoachAsk] = useState<{ q: string; n: number } | null>(null);
  const openCoach = useCallback((q?: string) => {
    setCoachOpen(true);
    if (q) setCoachAsk((a) => ({ q, n: (a?.n ?? 0) + 1 }));
  }, []);

  const load = useCallback(async (d?: string) => {
    setLoading(true);
    loadedAt.current = Date.now();
    try {
      const res = await fetch(`/api/dashboard${d ? `?date=${d}` : ''}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.status === 401) {
        // Session ended or Google access expired: back to the start page.
        window.location.href = json.error === 'signed_out' ? '/' : '/?auth=expired';
        return;
      }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date); // eslint-disable-line react-hooks/set-state-in-effect -- fetch when the day changes
  }, [date, load]);

  // Coming back to the tab after a while: fetch again so a fresh band sync shows up.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - loadedAt.current > 5 * 60_000) load(date);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [date, load]);

  // ← and → step through days.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!data || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest('input, textarea, [role="tablist"]')) return;
      const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      if (!step) return;
      const next = shiftDate(data.date, step);
      if (data.trends.some((r) => r.date === next)) {
        e.preventDefault();
        setDate(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data]);

  const showMetric = (k: TrendKey) => {
    setMetric(k);
    document.getElementById('trends')?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  // Keep the dial's "now" hand moving on today's view.
  useEffect(() => {
    if (!data || data.date !== data.today) {
      setNowMin(null); // eslint-disable-line react-hooks/set-state-in-effect -- no hand on past days
      return;
    }
    const tick = () => setNowMin(minutesIn(data.timeZone));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [data]);

  const failed = data ? Object.entries(data.errors).filter(([k]) => k !== 'device') : [];

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 pb-16">
        <TopBar data={data} loading={loading} onRefresh={() => load(date)} />

        {error && (
          <div className="panel p-5 mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-heart">Your data didn’t load: {error}</p>
            <button onClick={() => load(date)} className="h-10 px-5 rounded-full bg-ink text-bg font-semibold text-sm">
              Try again
            </button>
          </div>
        )}
        {failed.length > 0 && (
          <p className="mt-2 text-sm text-heart">
            Google didn’t return {failed.map(([k]) => k).join(', ')} this time. Refresh to try again.
          </p>
        )}

        {!data && !error && (
          <div className="grid lg:grid-cols-[1fr_minmax(0,520px)] gap-10 items-center py-12" aria-busy="true">
            <div className="space-y-4">
              <div className="h-16 w-3/4 rounded-2xl bg-surface animate-pulse" />
              <div className="h-10 w-1/2 rounded-2xl bg-surface animate-pulse" />
            </div>
            <div className="aspect-square rounded-full border-[22px] border-surface animate-pulse" />
          </div>
        )}

        {data && (
          <motion.main animate={{ opacity: loading ? 0.55 : 1 }} transition={{ duration: 0.25 }} className="space-y-6">
            <section className="grid lg:grid-cols-[1fr_minmax(0,520px)] lg:grid-rows-[auto_1fr] gap-x-12 gap-y-10 py-8 lg:py-12">
              <div className="lg:col-start-1 lg:row-start-1 self-end">
                <Hero data={data} onDate={setDate} onMetric={showMetric} part="date" />
              </div>
              <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 self-center">
                <BodyClock data={data} nowMin={nowMin} />
              </div>
              <div className="lg:col-start-1 lg:row-start-2">
                <Hero data={data} onDate={setDate} onMetric={showMetric} part="vitals" />
              </div>
            </section>

            {data.day.sleep ? (
              <SleepPanel
                sleep={data.day.sleep}
                avgNights={data.averages.sleepMinutes?.days}
                title={data.date === data.today ? 'Last night' : `The night before ${new Date(`${data.date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`}
              />
            ) : data.date !== data.today ? (
              <section className="panel p-6 sm:p-8">
                <h2 className="font-display text-2xl font-semibold tracking-tight">Sleep</h2>
                <p className="mt-1 text-ink-2">The band didn’t record a night’s sleep ending on this day.</p>
              </section>
            ) : null}

            <HeartPanel
              date={data.date}
              data={data.day.heartRate}
              zones={data.day.hrZones}
              restingHr={data.day.restingHr}
              sleep={data.day.sleep}
              exercises={data.day.exercises}
            />

            <TrendsPanel data={data} metric={metric} onMetric={setMetric} onDate={setDate} />

            <div className="grid lg:grid-cols-2 gap-6 items-start">
              <ActivityPanel data={data} />
              <CoachCard data={data} onAsk={openCoach} />
            </div>
          </motion.main>
        )}

        {data && (
          <>
            {!coachOpen && <CoachLauncher onOpen={() => openCoach()} />}
            <CoachDrawer data={data} open={coachOpen} onOpenChange={setCoachOpen} ask={coachAsk} />
          </>
        )}

        <footer className="mt-10 pb-16 sm:pb-0 text-[13px] text-muted flex flex-wrap justify-between gap-2">
          <span>
            Everything here was recorded by your {data?.device?.name ?? 'Fitbit band'}
            {data?.bandSince && ` since ${new Date(`${data.bandSince}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`}, read through Google Health
            {data && ` in ${data.timeZone.replace('_', ' ')} time`}.
          </span>
          {data && data.trends.length > 1 && <span>Use ← and → to move between days.</span>}
        </footer>
      </div>
    </MotionConfig>
  );
}

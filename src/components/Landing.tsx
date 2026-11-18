'use client';

import { useEffect } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { ThemeSwitch } from './ThemeSwitch';
import { Logo } from './Logo';

const NOTICE: Record<string, { tone: 'info' | 'warn'; text: string }> = {
  denied: { tone: 'warn', text: 'You didn’t give access, so there’s nothing to show yet. Continue with Google whenever you’re ready.' },
  scopes: { tone: 'warn', text: 'A few boxes were left unticked on Google’s screen. Tick all of them so your sleep, heart and activity can be shown together.' },
  expired: { tone: 'warn', text: 'Your Google connection timed out. Continue with Google to pick up where you left off.' },
  not_allowed: { tone: 'warn', text: 'This app is invite-only for now, and that Google account isn’t on the list.' },
  failed: { tone: 'warn', text: 'Something went wrong while talking to Google. Please try again.' },
  setup: { tone: 'warn', text: 'Sign-in is unavailable right now. Please try again in a little while.' },
  signed_out: { tone: 'info', text: 'You’re signed out.' },
  disconnected: { tone: 'info', text: 'Disconnected. The app no longer has access to your Google health data, and your saved connection is deleted.' },
};

const PERMISSIONS = [
  { color: 'var(--move)', title: 'Activity and fitness', body: 'Steps, distance, calories, active zone minutes and workouts.' },
  { color: 'var(--heart)', title: 'Health measurements', body: 'Heart rate, resting heart rate, HRV, blood oxygen, breathing rate and skin temperature.' },
  { color: 'var(--sleep)', title: 'Sleep', body: 'When you slept and your time in deep, light and REM sleep.' },
  { color: 'var(--awake)', title: 'Device and settings', body: 'Your band’s battery and last sync, your time zone and units.' },
];

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function ConnectButton({ big }: { big?: boolean }) {
  return (
    <a
      href="/api/auth/google"
      className={`group inline-flex items-center gap-3 rounded-full bg-ink text-bg font-semibold shadow-lg shadow-ink/15 hover:-translate-y-0.5 hover:shadow-xl transition-all ${big ? 'h-14 pl-2 pr-7 text-base' : 'h-12 pl-1.5 pr-6 text-sm'}`}
    >
      <span className={`rounded-full bg-white grid place-items-center ${big ? 'w-10 h-10' : 'w-9 h-9'}`}>
        <GoogleG />
      </span>
      Continue with Google
    </a>
  );
}

// Decorative dial: the shape of the app, drawn in. No data in it.
function Dial() {
  const C = 200;
  const r2 = (n: number) => Math.round(n * 100) / 100; // same digits on server and browser
  const arc = (r: number, a0: number, a1: number) => {
    const p = (a: number) => [r2(C + r * Math.cos(((a - 90) * Math.PI) / 180)), r2(C + r * Math.sin(((a - 90) * Math.PI) / 180))];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1},${y1}`;
  };
  const night: [number, number, string][] = [
    [-30, -18, 'var(--light-sleep)'], [-18, 2, 'var(--deep)'], [2, 30, 'var(--light-sleep)'], [30, 44, 'var(--rem)'],
    [44, 80, 'var(--light-sleep)'], [80, 90, 'var(--deep)'], [90, 118, 'var(--light-sleep)'], [118, 136, 'var(--rem)'], [136, 142, 'var(--awake)'],
  ];
  const wave = Array.from({ length: 181 }, (_, i) => {
    const a = i * 2;
    const r = 92 + 18 * Math.sin(a / 9) * Math.sin(a / 23) + (a > 150 && a < 290 ? 22 : 0) * Math.sin(((a - 150) / 140) * Math.PI);
    return `${i ? 'L' : 'M'}${r2(C + r * Math.cos(((a - 90) * Math.PI) / 180))},${r2(C + r * Math.sin(((a - 90) * Math.PI) / 180))}`;
  }).join(' ');
  const draw = (delay: number, duration = 0.5) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { pathLength: { delay, duration, ease: [0.65, 0, 0.35, 1] as const }, opacity: { delay, duration: 0.01 } },
  });
  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-[460px] mx-auto" aria-hidden>
      <circle cx={C} cy={C} r={160} fill="none" stroke="var(--surface)" strokeWidth={22} />
      <circle cx={C} cy={C} r={138} fill="none" stroke="var(--surface)" strokeWidth={7} />
      {Array.from({ length: 24 }, (_, h) => {
        const a = ((h * 15 - 90) * Math.PI) / 180;
        const r0 = h % 6 ? 178 : 175;
        return <line key={h} x1={r2(C + r0 * Math.cos(a))} y1={r2(C + r0 * Math.sin(a))} x2={r2(C + 184 * Math.cos(a))} y2={r2(C + 184 * Math.sin(a))} stroke="var(--muted)" strokeWidth={h % 6 ? 1 : 1.6} opacity={h % 6 ? 0.5 : 1} />;
      })}
      {night.map(([a0, a1, c], i) => (
        <motion.path key={i} d={arc(160, a0 < 0 ? 360 + a0 : a0, a1 < 0 ? 360 + a1 : a1 <= a0 ? a1 + 360 : a1)} fill="none" stroke={c} strokeWidth={22} {...draw(0.2 + i * 0.09, 0.22)} />
      ))}
      <motion.path d={arc(138, 255, 275)} fill="none" stroke="var(--move)" strokeWidth={7} strokeLinecap="round" {...draw(1.1, 0.4)} />
      <motion.path d={wave} fill="none" stroke="var(--heart)" strokeWidth={1.8} strokeLinejoin="round" {...draw(0.5, 1.6)} />
      <circle cx={C} cy={C} r={58} fill="var(--surface)" />
      <motion.g initial={{ rotate: -40 }} animate={{ rotate: 0 }} transition={{ delay: 0.3, duration: 1.6, ease: [0.16, 1, 0.3, 1] }} style={{ transformOrigin: '200px 200px' }}>
        <line x1={C} y1={C - 58} x2={C} y2={C - 176} stroke="var(--ink)" strokeWidth={1.6} strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}

export function Landing({ notice }: { notice?: string }) {
  const n = notice ? NOTICE[notice] : undefined;

  // Drop ?auth=... from the address bar once it has been shown.
  useEffect(() => {
    if (notice) window.history.replaceState(null, '', '/');
  }, [notice]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 pb-16">
        <header className="flex items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <span className="font-display text-xl font-bold tracking-[-0.03em] text-ink">vitalis</span>
          </div>
          <ThemeSwitch />
        </header>

        {n && (
          <motion.p
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-2 rounded-2xl px-5 py-4 text-[15px] ${n.tone === 'warn' ? 'bg-awake/15 text-ink' : 'bg-surface text-ink-2'}`}
          >
            {n.text}
          </motion.p>
        )}

        <section className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-16 items-center py-10 lg:py-16">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
            <h1 className="font-display font-bold text-ink leading-[0.95] tracking-[-0.035em] text-[clamp(2.5rem,5.2vw,4rem)] max-w-[13ch]">
              Your sleep, heart and movement around the clock.
            </h1>
            <p className="mt-6 text-lg text-ink-2 leading-relaxed max-w-[34rem]">
              Connect the Google account your Fitbit syncs to. Vitalis draws your whole day on one dial, shows how each night went, and gives you a coach who answers from your own numbers.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <ConnectButton big />
              <span className="text-sm text-muted">Read-only. Nothing in your Fitbit account is changed.</span>
            </div>
          </motion.div>
          <Dial />
        </section>

        <section className="grid lg:grid-cols-[1fr_1.15fr] gap-6">
          <div className="panel p-6 sm:p-8">
            <h2 className="font-display text-2xl font-semibold tracking-tight">Getting in takes a minute</h2>
            <ol className="mt-6 space-y-5">
              {[
                ['Continue with Google', 'Pick the Google account your Fitbit app uses.'],
                ['Tick every box', 'Google lists each kind of data separately. The dashboard needs all four to show your day properly.'],
                ['You’re in', 'You land on today’s dial. After that it opens straight to your data.'],
              ].map(([t, b], i) => (
                <li key={t} className="flex gap-4">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-surface-2 grid place-items-center font-display font-semibold text-ink">{i + 1}</span>
                  <div>
                    <p className="font-semibold text-ink">{t}</p>
                    <p className="text-ink-2 mt-0.5">{b}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="panel p-6 sm:p-8">
            <h2 className="font-display text-2xl font-semibold tracking-tight">What Google will ask you to allow</h2>
            <p className="mt-1 text-ink-2">Read access only, to these four kinds of data.</p>
            <ul className="mt-6 grid sm:grid-cols-2 gap-3">
              {PERMISSIONS.map((p, i) => (
                <motion.li
                  key={p.title}
                  className="rounded-2xl bg-surface-2 p-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.06 }}
                >
                  <p className="font-semibold text-ink flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                    {p.title}
                  </p>
                  <p className="mt-1 text-sm text-ink-2 leading-relaxed">{p.body}</p>
                </motion.li>
              ))}
            </ul>
          </div>
        </section>

        <section className="panel p-6 sm:p-8 mt-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Your data stays yours</h2>
          <ul className="mt-5 grid md:grid-cols-3 gap-6 text-ink-2 leading-relaxed">
            <li>
              <p className="font-semibold text-ink">Read when you look</p>
              Your numbers are fetched from Google when you open the app. Only your Google connection is saved, so you stay signed in.
            </li>
            <li>
              <p className="font-semibold text-ink">The coach</p>
              When you ask a question, a summary of your daily figures goes to Groq to write the answer. Nothing else is sent, and nothing is sold or shared.
            </li>
            <li>
              <p className="font-semibold text-ink">Leave any time</p>
              Disconnect from the account menu. That revokes access at Google and deletes your saved connection.
            </li>
          </ul>
          <div className="mt-8">
            <ConnectButton />
          </div>
        </section>

        <footer className="mt-10 text-[13px] text-muted">Not a medical device. For questions about your health, talk to a doctor.</footer>
      </div>
    </MotionConfig>
  );
}

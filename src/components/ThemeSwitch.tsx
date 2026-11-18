'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

type Choice = 'light' | 'dark' | 'system';

function apply(choice: Choice) {
  const dark = choice === 'dark' || (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

const OPTIONS: { value: Choice; label: string; icon: React.ReactNode }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: 'system',
    label: 'Match device',
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <rect x="2" y="3" width="12" height="8" rx="1.5" />
        <path d="M6 13.5h4" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function ThemeSwitch() {
  const [choice, setChoice] = useState<Choice>('system');

  useEffect(() => {
    let saved: Choice = 'system';
    try {
      saved = (localStorage.getItem('theme') as Choice) || 'system';
    } catch {}
    setChoice(saved); // eslint-disable-line react-hooks/set-state-in-effect -- read saved choice once on mount
  }, []);

  useEffect(() => {
    if (choice !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => apply('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [choice]);

  const pick = (c: Choice) => {
    setChoice(c);
    apply(c);
    try {
      localStorage.setItem('theme', c);
    } catch {}
  };

  return (
    <div role="radiogroup" aria-label="Theme" className="relative flex items-center gap-0.5 p-1 rounded-full bg-surface">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={choice === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => pick(o.value)}
          className={`relative w-8 h-8 rounded-full grid place-items-center transition-colors ${choice === o.value ? 'text-ink' : 'text-muted hover:text-ink-2'}`}
        >
          {choice === o.value && (
            <motion.span layoutId="theme-pill" className="absolute inset-0 rounded-full bg-surface-2" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
          )}
          <span className="relative">{o.icon}</span>
        </button>
      ))}
    </div>
  );
}

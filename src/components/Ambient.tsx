'use client';

import { useEffect, useState } from 'react';

type Phase = 'night' | 'dawn' | 'day' | 'dusk';

// Colours follow the time of day, so the page feels like the hour it's opened in.
const PALETTE: Record<Phase, [string, string, string]> = {
  night: ['var(--deep)', 'var(--rem)', 'var(--sleep)'],
  dawn: ['var(--awake)', 'var(--heart)', 'var(--light-sleep)'],
  day: ['var(--move)', 'var(--breath)', 'var(--light-sleep)'],
  dusk: ['var(--heart)', 'var(--rem)', 'var(--awake)'],
};

const phaseAt = (h: number): Phase => (h >= 21 || h < 5 ? 'night' : h < 9 ? 'dawn' : h < 17 ? 'day' : 'dusk');

// Slow, soft light drifting behind the page. Purely decorative.
export function Ambient() {
  const [phase, setPhase] = useState<Phase | null>(null);

  useEffect(() => {
    const tick = () => setPhase(phaseAt(new Date().getHours()));
    tick();
    const id = setInterval(tick, 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  const [a, b, c] = PALETTE[phase ?? 'night'];
  return (
    <div className="ambient" data-ready={phase ? '' : undefined} aria-hidden>
      <span className="ambient-orb ambient-1" style={{ background: a }} />
      <span className="ambient-orb ambient-2" style={{ background: b }} />
      <span className="ambient-orb ambient-3" style={{ background: c }} />
    </div>
  );
}

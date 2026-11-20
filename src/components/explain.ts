import type { SleepStageInterval } from '../types/dashboard';
import type { TrendKey } from './TrendsPanel';

// Plain-language meaning of every measurement, for people new to sleep and fitness tracking.
// `short` fits on a tile; `long` sits above the trend chart.
export const EXPLAIN: Record<TrendKey, { short: string; long: string }> = {
  sleepMinutes: {
    short: 'Time actually asleep, not just in bed.',
    long: 'Time you were actually asleep, not just lying in bed. Most adults need 7–9 hours.',
  },
  restingHr: {
    short: 'Your heartbeat at full rest. Lower is usually fitter.',
    long: 'How fast your heart beats when you’re completely relaxed. Lower usually means a fitter, more rested heart.',
  },
  hrv: {
    short: 'Tiny gaps between beats. Higher means better recovered.',
    long: 'Heart rate variability: the tiny changes in time between heartbeats. Higher usually means your body has recovered well. Compare it with your own normal, not with other people.',
  },
  spo2: {
    short: 'Oxygen in your blood overnight. 95–100% is typical.',
    long: 'Blood oxygen: how much oxygen your blood carries while you sleep. 95–100% is typical for most people.',
  },
  respRate: {
    short: 'Breaths per minute while asleep. 12–20 is typical.',
    long: 'How many breaths you take per minute while asleep. Most adults sit between 12 and 20, and it usually stays steady night to night.',
  },
  skinTempDevC: {
    short: 'Overnight skin vs your normal. Big jumps can mean illness.',
    long: 'How much warmer or cooler your skin was overnight than your usual. A sudden rise can be an early sign you’re getting ill.',
  },
  steps: {
    short: 'Every step the band counted.',
    long: 'Every step the band counted. Around 7,000–10,000 a day is a common healthy target.',
  },
  azm: {
    short: 'Minutes your heart was working hard enough to count as exercise.',
    long: 'Active zone minutes: minutes your heart was working hard enough to count as exercise. 150 a week is the usual health goal.',
  },
};

export const STAGE_HINT: Record<SleepStageInterval['stage'], string> = {
  deep: 'Body repair and recovery. Hardest to wake from.',
  light: 'Most of the night. Easy to wake from.',
  rem: 'Dreaming sleep. Helps memory and mood.',
  wake: 'Brief wake-ups. A few each night is normal.',
};

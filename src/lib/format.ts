import type { DashboardData } from '../types/dashboard';

export const dur = (m: number) =>
  m >= 60 ? `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m` : `${Math.round(m)}m`;

export const signed = (n: number, digits = 0) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(digits)}`;

export function distance(mm: number, unit: DashboardData['units']['distance']) {
  const v = unit === 'mi' ? mm / 1_609_344 : mm / 1_000_000;
  return `${v.toFixed(2)} ${unit}`;
}

// Temperature *difference* (deviation) in the user's unit.
export function tempDelta(c: number, unit: DashboardData['units']['temperature']) {
  return unit === 'F' ? c * 1.8 : c;
}

export function prettyDate(ymd: string, today: string) {
  const d = new Date(`${ymd}T00:00:00Z`);
  const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  if (ymd === today) return `Today · ${label}`;
  const y = new Date(`${today}T00:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (ymd === y.toISOString().slice(0, 10)) return `Yesterday · ${label}`;
  return label;
}

// "Wednesday, 18 November"
export function longDate(ymd: string) {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

export const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export const shiftDate = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// "Today", "Yesterday", "3 days ago"
export function relativeDay(ymd: string, today: string) {
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${ymd}T00:00:00Z`)) / 86400000);
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
}

// "just now", "12 min ago", "3 h ago", "2 days ago"
export function ago(iso: string, now = Date.now()) {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

// "18 Nov"
export const shortDate = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

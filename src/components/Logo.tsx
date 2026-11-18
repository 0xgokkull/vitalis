// The Vitalis mark: a V on an indigo tile, its right arm ending in a heartbeat dot.
// Uses theme tokens, so it switches with light and dark mode.
export function Logo({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden>
      <rect width="512" height="512" rx="120" fill="var(--sleep)" />
      <path d="M140 164L256 372L352 200" fill="none" stroke="var(--surface)" strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="378" cy="150" r="34" fill="var(--heart)" />
    </svg>
  );
}

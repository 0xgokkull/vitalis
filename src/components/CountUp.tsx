'use client';

import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';

// Counts from 0 to `value` once, then follows changes. Text is the final value for screen readers.
export function CountUp({ value, format, delay = 0 }: { value: number; format: (v: number) => string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = format(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration: 1.1,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = format(v);
      },
    });
    from.current = value;
    return () => controls.stop();
  }, [value, format, delay, reduce]);

  return (
    <span ref={ref} aria-label={format(value)}>
      {format(reduce ? value : 0)}
    </span>
  );
}

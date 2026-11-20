'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { DashboardData } from '../types/dashboard';
import { shortDate } from '../lib/format';

type Msg = { role: 'user' | 'assistant'; content: string; error?: boolean };


// The model ends each reply with "NEXT: q1? | q2?". Split that off, and hide a half-streamed "NEX".
function split(text: string) {
  const m = text.match(/\n*\s*NEXT:\s*([\s\S]*)$/);
  const body = (m ? text.slice(0, m.index) : text.replace(/\n+\s*N(E(X(T)?)?)?$/, '')).trim();
  const next = m ? m[1].split('|').map((q) => q.trim()).filter((q) => q.length > 3) : [];
  return { body, next };
}

// Tiny renderer: paragraphs, "- " lists and **bold**. Nothing else is trusted as markup.
function Rich({ text }: { text: string }) {
  const bold = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>
    );
  return (
    <>
      {text.split(/\n{2,}/).map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim());
        if (lines.length && lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            <ul key={i} className="my-2 space-y-1.5">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="mt-[0.6em] w-1.5 h-1.5 shrink-0 rounded-full bg-sleep" />
                  <span>{bold(l.replace(/^\s*[-*•]\s+/, ''))}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="my-2 first:mt-0">
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {bold(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

function Mark({ size = 36 }: { size?: number }) {
  return (
    <span className="shrink-0 rounded-full bg-surface-2 grid place-items-center" style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 20 20" style={{ width: size * 0.55, height: size * 0.55 }}>
        <circle cx="10" cy="10" r="7" fill="none" stroke="var(--sleep)" strokeWidth="2.5" strokeDasharray="15 30" strokeLinecap="round" transform="rotate(-150 10 10)" />
        <circle cx="10" cy="10" r="3" fill="var(--heart)" />
      </svg>
    </span>
  );
}

// Questions that fit the day on screen.
export function starters(data: DashboardData): string[] {
  const d = data.day;
  const day = data.date === data.today ? 'today' : `on ${shortDate(data.date)}`;
  const out: string[] = [];
  out.push(d.sleep ? (data.date === data.today ? 'How did I sleep last night?' : `How did I sleep before ${shortDate(data.date)}?`) : 'How have I been sleeping lately?');
  const a = data.averages.hrv;
  out.push(d.hrv != null && a && d.hrv < a.value - 2 ? 'Why is my HRV lower than usual?' : 'Am I recovering well?');
  if (d.exercises[0]) out.push(`How did my ${d.exercises[0].name.toLowerCase()} go?`);
  out.push(data.date === data.today ? 'What should I focus on today?' : `How active was I ${day}?`);
  out.push('How has my resting heart rate changed since I got the band?');
  return out.slice(0, 4);
}

interface Props {
  data: DashboardData;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ask: { q: string; n: number } | null; // a question sent from elsewhere on the page
}

export function CoachDrawer({ data, open, onOpenChange, ask }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastAsk = useRef(0);
  const STORE = `coach-chat:${data.account?.email ?? ''}`; // each account keeps its own chat

  // Keep the conversation across reloads (this browser only).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) ?? '[]');
      if (Array.isArray(saved)) setMsgs(saved); // eslint-disable-line react-hooks/set-state-in-effect -- restore once on mount
    } catch {}
  }, [STORE]);
  useEffect(() => {
    if (busy) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(msgs.slice(-40)));
    } catch {}
  }, [msgs, busy, STORE]);

  const scrollDown = () => requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }));

  const send = useCallback(
    async (text: string, base: Msg[] = msgs) => {
      const q = text.trim();
      if (!q || busy) return;
      const history: Msg[] = [...base.filter((m) => !m.error && m.content), { role: 'user', content: q }];
      setMsgs([...history, { role: 'assistant', content: '' }]);
      setInput('');
      setBusy(true);
      scrollDown();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const put = (content: string, error = false) =>
        setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', content, error }]);
      try {
        const res = await fetch('/api/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: data.date, messages: history.map(({ role, content }) => ({ role, content })) }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Something went wrong (${res.status}).`);
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let acc = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          put(acc);
          scrollDown();
        }
        if (!acc.trim()) throw new Error('No answer came back. Try asking again.');
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          setMsgs((m) => (m[m.length - 1]?.content ? m : m.slice(0, -1)));
        } else {
          put((e as Error).message, true);
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
        inputRef.current?.focus();
      }
    },
    [busy, msgs, data.date]
  );

  // Questions sent from the card on the page.
  useEffect(() => {
    if (ask && ask.n !== lastAsk.current) {
      lastAsk.current = ask.n;
      send(ask.q);
    }
  }, [ask, send]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false);
    window.addEventListener('keydown', onKey);
    // The page behind shouldn't scroll while the drawer is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    scrollDown();
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open, onOpenChange]);

  // Grow the box with the text, up to a limit.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  const last = msgs[msgs.length - 1];
  const followUps = !busy && last?.role === 'assistant' && !last.error ? split(last.content).next : [];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Coach"
            className="fixed z-50 inset-y-0 right-0 w-full sm:w-[460px] sm:my-3 sm:mr-3 sm:inset-y-auto sm:top-0 sm:bottom-0 bg-surface sm:rounded-3xl shadow-2xl shadow-ink/20 flex flex-col overflow-hidden"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
            initial={{ x: '105%' }}
            animate={{ x: 0 }}
            exit={{ x: '105%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          >
            <header className="flex items-center gap-3 px-5 py-4 border-b border-line">
              <Mark />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-semibold leading-tight">Coach</h2>
                <p className="text-[13px] text-muted truncate">
                  Knows your band data{data.bandSince ? ` since ${shortDate(data.bandSince)}` : ''}, looking at {data.date === data.today ? 'today' : shortDate(data.date)}
                </p>
              </div>
              {msgs.length > 0 && (
                <button
                  onClick={() => {
                    abortRef.current?.abort();
                    setMsgs([]);
                  }}
                  className="h-9 px-3 rounded-full text-sm text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors"
                >
                  New chat
                </button>
              )}
              <button onClick={() => onOpenChange(false)} aria-label="Close coach" className="w-9 h-9 rounded-full grid place-items-center text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors">
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="m4 4 8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-5" aria-live="polite">
              {msgs.length === 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <p className="font-display text-2xl font-semibold leading-snug">Hey! What would you like to know?</p>
                  <p className="mt-2 text-ink-2 leading-relaxed">
                    I read what your band records: sleep, heart rate, HRV, blood oxygen, breathing, skin temperature, steps and workouts. Ask in your own words.
                  </p>
                  <div className="mt-5 flex flex-col items-start gap-2">
                    {starters(data).map((q, i) => (
                      <motion.button
                        key={q}
                        onClick={() => send(q)}
                        className="text-left px-4 py-2.5 rounded-2xl bg-surface-2 text-ink hover:bg-line transition-colors"
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.06 }}
                      >
                        {q}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {msgs.map((m, i) => {
                const streaming = busy && i === msgs.length - 1;
                if (m.role === 'user')
                  return (
                    <motion.div key={i} className="flex justify-end" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <p className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-ink text-bg whitespace-pre-wrap">{m.content}</p>
                    </motion.div>
                  );
                const { body } = split(m.content);
                return (
                  <motion.div key={i} className="flex gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <Mark size={28} />
                    <div className={`min-w-0 flex-1 leading-relaxed ${m.error ? 'text-heart' : 'text-ink-2'}`}>
                      {body ? (
                        <>
                          <Rich text={body} />
                          {streaming && <span className="inline-block w-1.5 h-4 -mb-0.5 ml-0.5 rounded-sm bg-sleep animate-pulse" aria-hidden />}
                        </>
                      ) : streaming ? (
                        <span className="inline-flex gap-1 py-2" aria-label="Coach is thinking">
                          {[0, 1, 2].map((d) => (
                            <motion.span key={d} className="w-2 h-2 rounded-full bg-muted" animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }} />
                          ))}
                        </span>
                      ) : null}
                      {m.error && !busy && i === msgs.length - 1 && (
                        <button
                          onClick={() => {
                            const q = [...msgs].reverse().find((x) => x.role === 'user')?.content;
                            if (q) send(q, msgs.slice(0, -2));
                          }}
                          className="mt-2 block h-9 px-4 rounded-full bg-surface-2 text-sm text-ink hover:bg-line transition-colors"
                        >
                          Try again
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {followUps.length > 0 && (
                <div className="pl-10 flex flex-wrap gap-2">
                  {followUps.map((q, i) => (
                    <motion.button
                      key={q}
                      onClick={() => send(q)}
                      className="text-left text-sm px-3.5 py-2 rounded-full border border-line text-ink-2 hover:text-ink hover:border-sleep transition-colors"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.08 }}
                    >
                      {q}
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            <form
              className="p-3 sm:p-4 border-t border-line"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <div className="flex items-end gap-2 rounded-3xl bg-surface-2 p-1.5 pl-4 focus-within:ring-2 focus-within:ring-sleep/40 transition-shadow">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={1}
                  maxLength={1000}
                  placeholder="Ask about your sleep, heart or activity"
                  aria-label="Your question"
                  className="flex-1 resize-none bg-transparent py-2 outline-none placeholder:text-muted max-h-36"
                />
                {busy ? (
                  <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Stop answering" className="w-10 h-10 shrink-0 rounded-full bg-ink text-bg grid place-items-center">
                    <span className="w-3 h-3 rounded-sm bg-current" />
                  </button>
                ) : (
                  <button type="submit" disabled={!input.trim()} aria-label="Send" className="w-10 h-10 shrink-0 rounded-full bg-ink text-bg grid place-items-center disabled:opacity-30 transition-opacity">
                    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="mt-2 px-2 text-[11px] text-muted">Coaching, not medical advice. If something feels wrong, see a doctor.</p>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// The card on the page: a quick way in.
export function CoachCard({ data, onAsk }: { data: DashboardData; onAsk: (q?: string) => void }) {
  const [q, setQ] = useState('');
  return (
    <section className="panel p-6 sm:p-8 flex flex-col">
      <div className="flex items-center gap-3">
        <Mark size={40} />
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Coach</h2>
          <p className="text-ink-2">Ask anything about your sleep, heart and activity.</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {starters(data).map((s) => (
          <button key={s} onClick={() => onAsk(s)} className="text-left text-sm px-3.5 py-2 rounded-full bg-surface-2 text-ink hover:bg-line transition-colors">
            {s}
          </button>
        ))}
      </div>
      <form
        className="mt-6 flex items-center gap-2 rounded-full bg-surface-2 p-1.5 pl-5 focus-within:ring-2 focus-within:ring-sleep/40"
        onSubmit={(e) => {
          e.preventDefault();
          onAsk(q.trim() || undefined);
          setQ('');
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask your own question" aria-label="Ask the coach" className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-muted" />
        <button type="submit" className="h-10 px-5 rounded-full bg-ink text-bg text-sm font-semibold hover:opacity-90 transition-opacity">
          Ask
        </button>
      </form>
    </section>
  );
}

// Always-there button, bottom right.
export function CoachLauncher({ onOpen }: { onOpen: () => void }) {
  return (
    <motion.button
      onClick={onOpen}
      className="fixed z-30 right-4 sm:right-6 h-12 pl-2 pr-5 rounded-full bg-ink text-bg shadow-lg shadow-ink/25 flex items-center gap-2.5 font-semibold text-sm"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 1.2, type: 'spring', stiffness: 300, damping: 26 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.96 }}
    >
      <span className="w-8 h-8 rounded-full bg-bg grid place-items-center" aria-hidden>
        <svg viewBox="0 0 20 20" className="w-5 h-5">
          <circle cx="10" cy="10" r="7" fill="none" stroke="var(--sleep)" strokeWidth="2.5" strokeDasharray="15 30" strokeLinecap="round" transform="rotate(-150 10 10)" />
          <circle cx="10" cy="10" r="3" fill="var(--heart)" />
        </svg>
      </span>
      Ask coach
    </motion.button>
  );
}

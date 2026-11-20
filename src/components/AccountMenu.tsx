'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

function clearCoachChats() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('coach-chat')).forEach((k) => localStorage.removeItem(k));
  } catch {}
}

// Who's signed in, plus sign out and disconnect.
export function AccountMenu({ email, name }: { email: string; name: string | null }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<'out' | 'disconnect' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = async (kind: 'out' | 'disconnect') => {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(kind === 'out' ? '/api/auth/signout' : '/api/auth/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      if (kind === 'disconnect') clearCoachChats();
      window.location.href = kind === 'out' ? '/?auth=signed_out' : '/?auth=disconnected';
    } catch (e) {
      setError(`That didn’t work: ${(e as Error).message}`);
      setBusy(null);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          setConfirming(false);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${name ?? email}`}
        className="w-10 h-10 rounded-full bg-sleep text-white font-display font-semibold grid place-items-center uppercase hover:opacity-90 transition-opacity"
      >
        {(name ?? email)[0]}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className="absolute right-0 top-12 z-40 w-72 rounded-2xl bg-surface shadow-xl shadow-ink/15 border border-line p-2"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            style={{ transformOrigin: 'top right' }}
          >
            <div className="px-3 py-2.5">
              <p className="text-xs text-muted">Signed in with Google</p>
              {name && <p className="text-sm font-semibold text-ink truncate">{name}</p>}
              <p className={`text-sm truncate ${name ? 'text-ink-2' : 'text-ink'}`}>{email}</p>
            </div>
            <div className="h-px bg-line my-1" />
            {!confirming ? (
              <>
                <button role="menuitem" onClick={() => run('out')} disabled={!!busy} className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-ink hover:bg-surface-2 disabled:opacity-50">
                  {busy === 'out' ? 'Signing out…' : 'Sign out'}
                </button>
                <button role="menuitem" onClick={() => setConfirming(true)} className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-heart hover:bg-surface-2">
                  Disconnect Google account
                </button>
              </>
            ) : (
              <div className="px-3 py-2">
                <p className="text-sm text-ink-2 leading-relaxed">
                  This removes the app’s access to your Google health data and deletes your saved connection. You can connect again any time.
                </p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => run('disconnect')} disabled={!!busy} className="h-9 px-4 rounded-full bg-heart text-white text-sm font-semibold whitespace-nowrap disabled:opacity-60">
                    {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                  <button onClick={() => setConfirming(false)} className="h-9 px-4 rounded-full bg-surface-2 text-sm text-ink whitespace-nowrap">
                    Keep connected
                  </button>
                </div>
              </div>
            )}
            {error && <p className="px-3 pb-2 text-sm text-heart">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

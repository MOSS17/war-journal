import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { OverlayProvider, Toasts, useOverlay, type ModalSpec } from './components/overlay';
import { Footer } from './components/Shell';
import { ModalHost } from './forms/ModalHost';
import { WarBoard } from './screens/WarBoard';
import { Characters } from './screens/Characters';
import { Instances } from './screens/Instances';
import { Plans } from './screens/Plans';
import { Journal } from './screens/Journal';
import { Library } from './screens/Library';
import { Glance } from './screens/Glance';
import { useLiveUpdates } from './db/store';
import { importLocalData } from './db/localImport';
import { pendingCarryOver } from './db/account';
import { useAccount } from './db/supabase';
import { SaveError } from './db/supabase';

const KEYS: Record<string, ModalSpec> = {
  n: { kind: 'quick' },
  j: { kind: 'journal' },
  p: { kind: 'plan' },
  u: { kind: 'progress' },
  l: { kind: 'library' },
};

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t) return false;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

/** N opens Quick add; J, P, U, L open forms; / focuses search. */
function Shortcuts() {
  const { open, modal } = useOverlay();
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || modal || isTyping(e.target)) return;
      if (e.key === '/') {
        const box = document.querySelector<HTMLInputElement>('[data-search]');
        e.preventDefault();
        if (box) box.focus();
        else navigate('/library?focus=1');
        return;
      }
      const spec = KEYS[e.key.toLowerCase()];
      if (spec && !e.shiftKey) {
        e.preventDefault();
        open(spec);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, modal, navigate]);
  return null;
}

/**
 * Keeps the data in step with the server: live updates from other tabs and
 * devices, the one-time move of an older browser-only journal, and a message
 * when a save doesn't reach the server (the form stays open with its input).
 */
function CloudSync() {
  const { toast, open } = useOverlay();
  const account = useAccount();
  useLiveUpdates();
  // After signing in (by code, or by a link that reloaded the page), offer this browser's anonymous journal.
  const savedId = account && !account.anonymous ? account.id : null;
  useEffect(() => {
    if (!savedId || window.location.pathname === '/glance') return;
    pendingCarryOver()
      .then((c) => c && open({ kind: 'carryOver' }))
      .catch(() => {});
  }, [savedId, open]);
  useEffect(() => {
    importLocalData()
      .then((r) => r && toast(`Your journal now lives in the cloud (${r.records} records moved). This browser keeps its copy.`))
      .catch((e) => console.error('Moving the local journal failed', e));
  }, [toast]);
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      if (!(e.reason instanceof SaveError)) return;
      e.preventDefault();
      toast(e.reason.message);
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, [toast]);
  return null;
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  const { pathname } = useLocation();
  const glance = pathname === '/glance';
  return (
    <OverlayProvider>
      <Shortcuts />
      <ScrollTop />
      <CloudSync />
      <div className="app">
        <Routes>
          <Route path="/" element={<WarBoard />} />
          <Route path="/characters" element={<Characters />} />
          <Route path="/characters/:id" element={<Characters />} />
          <Route path="/instances" element={<Instances />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/library" element={<Library />} />
          <Route path="/glance" element={<Glance />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {!glance && <Footer />}
      </div>
      <ModalHost />
      <Toasts />
    </OverlayProvider>
  );
}

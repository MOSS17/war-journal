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

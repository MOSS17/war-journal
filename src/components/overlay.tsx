import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { PlanType } from '../lib/types';

export type ModalSpec =
  | { kind: 'quick' }
  | { kind: 'character'; id?: string }
  | { kind: 'progress'; characterId?: string }
  | { kind: 'plan'; id?: string; preset?: { type?: PlanType; instanceId?: string; ownerId?: string } }
  | {
      kind: 'journal';
      id?: string;
      preset?: { characterId?: string; title?: string; tags?: string[]; body?: string };
    }
  | { kind: 'library'; id?: string; preset?: { kind?: 'link' | 'note'; instanceId?: string; planId?: string } }
  | { kind: 'instanceProgress'; instanceId: string; characterId?: string }
  | { kind: 'instance'; id?: string }
  | { kind: 'event'; id?: string }
  | { kind: 'data' }
  | {
      kind: 'confirm';
      title: string;
      body: ReactNode;
      confirmLabel: string;
      onConfirm: () => void | Promise<void>;
      /** Where Cancel returns to, e.g. the form that asked. */
      back?: ModalSpec;
    };

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

interface Overlay {
  modal: ModalSpec | null;
  /** Changes each time a modal opens, so forms remount between specs. */
  modalKey: number;
  open: (m: ModalSpec) => void;
  close: () => void;
  toasts: Toast[];
  toast: (text: string, action?: Toast['action']) => void;
  dismiss: (id: number) => void;
  /** Toast each plan that a save just completed, with a prompt to write it up. */
  celebrate: (titles: string[]) => void;
}

const Ctx = createContext<Overlay | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [modalState, setModalState] = useState<{ spec: ModalSpec; key: number } | null>(null);
  const modalSeq = useRef(1);
  const setModal = useCallback((spec: ModalSpec | null) => {
    setModalState(spec ? { spec, key: modalSeq.current++ } : null);
  }, []);
  const modal = modalState?.spec ?? null;
  const modalKey = modalState?.key ?? 0;
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (text: string, action?: Toast['action']) => {
      const id = next.current++;
      setToasts((t) => [...t.slice(-2), { id, text, action }]);
      setTimeout(() => dismiss(id), action ? 8000 : 3500);
    },
    [dismiss],
  );
  const open = useCallback((m: ModalSpec) => setModal(m), [setModal]);
  const close = useCallback(() => setModal(null), [setModal]);
  const celebrate = useCallback(
    (titles: string[]) => {
      for (const t of titles) {
        toast(`War plan complete: ${t}`, {
          label: 'Write entry',
          run: () => setModal({ kind: 'journal', preset: { title: t, tags: ['milestone'] } }),
        });
      }
    },
    [toast, setModal],
  );

  const value = useMemo(
    () => ({ modal, modalKey, open, close, toasts, toast, dismiss, celebrate }),
    [modal, modalKey, open, close, toasts, toast, dismiss, celebrate],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOverlay(): Overlay {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOverlay outside OverlayProvider');
  return v;
}

export function Toasts() {
  const { toasts, dismiss } = useOverlay();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span className="grow">{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="btn2 sm"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" className="iconbtn" aria-label="Dismiss" onClick={() => dismiss(t.id)} style={{ width: 30, height: 30 }}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

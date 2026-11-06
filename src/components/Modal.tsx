import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';

/**
 * A centred dialog over a dimmed page; a full-height sheet on phones.
 * Esc or × closes. Enter in a single-line field submits.
 */
export function Modal({
  title,
  eyebrow,
  header,
  onClose,
  onSubmit,
  footer,
  children,
  size,
}: {
  title: string;
  eyebrow?: ReactNode;
  header?: ReactNode;
  onClose: () => void;
  onSubmit?: () => void;
  footer?: ReactNode;
  children: ReactNode;
  size?: 'wide' | 'narrow' | 'menu';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useRef(`m-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit?.();
  };

  return (
    <dialog
      ref={ref}
      className={`modal${size ? ` ${size}` : ''}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <form onSubmit={submit} style={{ display: 'contents' }}>
        {size !== 'menu' && (
          <div className="mh">
            {header ?? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                {eyebrow && <span className="eyebrow">{eyebrow}</span>}
                <h2 id={titleId}>{title}</h2>
              </div>
            )}
            <button type="button" className="iconbtn" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </div>
        )}
        {(size === 'menu' || header) && <h2 id={titleId} className="sr-only">{title}</h2>}
        {children}
        {footer && <div className="mf between">{footer}</div>}
      </form>
    </dialog>
  );
}

/** Props every form modal receives. */
export interface ModalProps {
  onClose: () => void;
}

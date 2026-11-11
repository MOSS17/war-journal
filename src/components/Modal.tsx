import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { Rivets } from './ui';

/**
 * A framed dialog with a title plaque, centred over a dimmed page; a full-height sheet on phones.
 * Esc or the red X closes. Enter in a single-line field submits.
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

  const isMenu = size === 'menu';
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
      {!isMenu && (
        <h2 id={titleId} className="plaque">
          {title}
        </h2>
      )}
      <form onSubmit={submit} className={`modal-frame ${isMenu ? 'modal-tip' : 'card'}`}>
        {!isMenu && <Rivets top={false} />}
        {!isMenu && (
          <div className={`mh${header || eyebrow ? '' : ' bare'}`}>
            {header ?? (eyebrow ? <span className="eyebrow">{eyebrow}</span> : null)}
            <button type="button" className="xbtn" aria-label="Close" onClick={onClose}>
              <span aria-hidden="true">X</span>
            </button>
          </div>
        )}
        {isMenu && <h2 id={titleId} className="sr-only">{title}</h2>}
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

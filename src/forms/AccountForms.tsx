// The account modal (save your account, sign in, manage) and the offer to copy
// a browser's anonymous journal into the account just signed in to.
import { useEffect, useRef, useState } from 'react';
import { Modal, type ModalProps } from '../components/Modal';
import { Field } from '../components/ui';
import { useOverlay } from '../components/overlay';
import { useAccount } from '../db/supabase';
import {
  carryOverBackup,
  carryOverSummary,
  confirmSave,
  confirmSignIn,
  copyCarryOver,
  deleteAccount,
  dropCarryOver,
  pendingCarryOver,
  requestSignIn,
  saveAccount,
  signOut,
  type CarryOver,
  type EmailResult,
} from '../db/account';
import { downloadJson } from '../db/backup';
import { todayISO } from '../lib/logic';

export type AccountStep = 'save' | 'signin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Save your account (anonymous), sign in (visitor or anonymous), or manage it (saved). */
export function AccountModal({ step, onClose }: ModalProps & { step?: AccountStep }) {
  const account = useAccount();
  // The view is fixed when the modal opens, so finishing a save or sign-in doesn't swap it mid-way.
  const opened = useRef<typeof account>(undefined);
  if (opened.current === undefined && account !== undefined) opened.current = account;
  const at = opened.current;
  if (at === undefined) return null;
  if (at && !at.anonymous) return <ManageAccount email={account?.email ?? at.email ?? ''} onClose={onClose} />;
  return <EmailFlow initial={at ? (step ?? 'save') : 'signin'} canSave={!!at} onClose={onClose} />;
}

function EmailFlow({ initial, canSave, onClose }: { initial: AccountStep; canSave: boolean; onClose: () => void }) {
  const { toast } = useOverlay();
  const [mode, setMode] = useState<AccountStep>(initial);
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(false);

  const saving = mode === 'save';
  const title = saving ? 'Save your account' : 'Sign in';

  const send = async (to = email) => {
    setError(null);
    setExists(false);
    if (!EMAIL_RE.test(to.trim())) return setError('Enter your email address.');
    setBusy(true);
    let r: EmailResult;
    try {
      r = saving ? await saveAccount(to) : await requestSignIn(to);
    } catch {
      r = { ok: false, reason: 'other', message: 'Couldn’t send the email. Check your connection and try again.' };
    } finally {
      setBusy(false);
    }
    if (r.ok) {
      setSentTo(to.trim());
      setCode('');
    } else {
      setError(r.message);
      setExists(saving && r.reason === 'exists');
    }
  };

  const verify = async () => {
    setError(null);
    if (!/^\d{6,10}$/.test(code.trim())) return setError('Enter the code from the email.');
    setBusy(true);
    const ok = await (saving ? confirmSave(sentTo!, code) : confirmSignIn(sentTo!, code)).catch(() => false);
    setBusy(false);
    if (!ok) return setError('That code is wrong or has expired. Check the newest email, or send a new one.');
    toast(saving ? `Saved. Sign in anywhere with ${sentTo}.` : `Signed in as ${sentTo}`);
    onClose();
  };

  const switchToSignIn = () => {
    setMode('signin');
    setExists(false);
    setError(null);
    setSentTo(null);
  };

  if (sentTo) {
    return (
      <Modal
        title="Check your email"
        eyebrow={title}
        onClose={onClose}
        size="narrow"
        onSubmit={verify}
        footer={
          <>
            <button type="button" className="linkbtn" onClick={() => setSentTo(null)}>
              Use a different email
            </button>
            <div className="row-gap">
              <button type="button" className="btn2" onClick={() => send(sentTo)} disabled={busy}>
                Send again
              </button>
              <button type="submit" className="btn" disabled={busy}>
                {saving ? 'Save' : 'Sign in'}
              </button>
            </div>
          </>
        }
      >
        <div className="mb">
          <p className="muted">
            We sent a code to <strong>{sentTo}</strong>. Enter it here, or open the link in the email on the device where you play.
          </p>
          <Field label="Code from the email" htmlFor="acc-code" error={error}>
            <input
              id="acc-code"
              className="inp tab"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={10}
              value={code}
              aria-invalid={!!error}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={title}
      eyebrow="Your account"
      onClose={onClose}
      size="narrow"
      onSubmit={() => send()}
      footer={
        <>
          {canSave ? (
            <button type="button" className="linkbtn" onClick={() => (saving ? switchToSignIn() : setMode('save'))}>
              {saving ? 'I already have an account' : 'Save this journal instead'}
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
        </>
      }
    >
      <div className="mb">
        <p className="muted">
          {saving
            ? 'Right now your journal is tied to this browser. Add your email so clearing browser data never loses it, and so you can sign in on any device.'
            : 'We’ll email you a code and a sign-in link. No password needed.'}
        </p>
        <Field label="Email" htmlFor="acc-email" error={error}>
          <input
            id="acc-email"
            className="inp"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            aria-invalid={!!error}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        {exists && (
          <button type="button" className="btn2" style={{ alignSelf: 'flex-start' }} onClick={switchToSignIn}>
            Sign in to that account instead
          </button>
        )}
      </div>
    </Modal>
  );
}

function ManageAccount({ email, onClose }: { email: string; onClose: () => void }) {
  const { toast } = useOverlay();
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const out = async () => {
    setBusy(true);
    await signOut();
    toast('Signed out');
    onClose();
  };

  const remove = async () => {
    setError(null);
    setBusy(true);
    try {
      await deleteAccount();
      toast('Your account and journal were deleted');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t delete your account.');
      setBusy(false);
    }
  };

  return (
    <Modal title="Your account" eyebrow="Saved" onClose={onClose} size="narrow">
      <div className="mb">
        <p className="muted">
          Signed in as <strong>{email}</strong>. Sign in with this email on any device to open the same journal.
        </p>
        <button type="button" className="btn2" style={{ alignSelf: 'flex-start' }} onClick={out} disabled={busy}>
          Sign out of this browser
        </button>
        <div style={{ borderTop: '1px solid var(--sunk-edge)', paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="lab">Delete account</span>
          <span className="help">
            Deletes your account, every character, plan, entry and link, and your screenshots. This can’t be undone. Export a
            backup first from Backup &amp; data if you want a copy.
          </span>
          <Field label="Type DELETE to confirm" htmlFor="acc-delete" error={error}>
            <input id="acc-delete" className="inp" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </Field>
          <button
            type="button"
            className="btn2 danger"
            style={{ alignSelf: 'flex-start' }}
            disabled={busy || confirmText.trim() !== 'DELETE'}
            onClick={remove}
          >
            Delete my account
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** After signing in: copy this browser's anonymous journal into the account, or leave it. */
export function CarryOverModal({ onClose }: ModalProps) {
  const { toast } = useOverlay();
  const [offer, setOffer] = useState<CarryOver | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pendingCarryOver().then(setOffer, () => setOffer(null));
  }, []);
  useEffect(() => {
    if (offer === null) onClose();
  }, [offer, onClose]);
  if (!offer) return null;

  const summary = carryOverSummary(offer);
  const copy = async () => {
    setBusy(true);
    setError(null);
    try {
      const n = await copyCarryOver(offer);
      toast(n ? `Copied ${summary} into your account` : 'Your account already had all of it');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t copy your journal.');
      setBusy(false);
    }
  };
  const leave = async () => {
    await dropCarryOver();
    onClose();
  };

  return (
    <Modal
      title="Bring this browser’s journal along?"
      eyebrow="Signed in"
      onClose={leave}
      size="narrow"
      onSubmit={copy}
      footer={
        <>
          <button type="button" className="linkbtn" onClick={async () => downloadJson(await carryOverBackup(offer), `war-journal-browser-${todayISO()}.json`)}>
            Download it as a backup
          </button>
          <div className="row-gap">
            <button type="button" className="btn2" onClick={leave} disabled={busy}>
              Leave it
            </button>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Copying…' : 'Copy into my account'}
            </button>
          </div>
        </>
      }
    >
      <div className="mb">
        <p className="muted">
          Before you signed in, this browser had its own journal: {summary}. Copy it into your account, or leave it behind. Anything
          your account already has stays as it is.
        </p>
        {error && (
          <span className="err" role="alert">
            {error}
          </span>
        )}
      </div>
    </Modal>
  );
}

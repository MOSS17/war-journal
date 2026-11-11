// Reminds anonymous players to save their account: after their first
// character, after their first plan or journal entry, and every fifth visit.
// It stops after three "Not now"s. The footer link stays either way.
import { useEffect, useState } from 'react';
import { useOverlay } from './overlay';
import { useAccount } from '../db/supabase';
import { useCharacters, useJournal, usePlans } from '../db/hooks';

interface ReminderState {
  visits: number;
  dismissals: number;
  /** Reminders already shown and answered, e.g. "first-character" or "visit-10". */
  answered: string[];
}

const KEY = 'war-journal:save-reminder';
const MAX_DISMISSALS = 3;

function read(): ReminderState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '') as ReminderState;
    if (typeof s.visits === 'number' && Array.isArray(s.answered)) return s;
  } catch {
    // No saved state yet, or storage is blocked.
  }
  return { visits: 0, dismissals: 0, answered: [] };
}

function write(s: ReminderState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: the reminder just shows again next visit.
  }
}

// Counted once per page load, not per screen.
let countedThisLoad = false;

export function SaveReminder() {
  const { open } = useOverlay();
  const account = useAccount();
  const characters = useCharacters();
  const plans = usePlans();
  const journal = useJournal();
  const [state, setState] = useState(read);

  const anonymous = account?.anonymous === true;
  useEffect(() => {
    if (!anonymous || countedThisLoad) return;
    countedThisLoad = true;
    setState((s) => {
      const next = { ...s, visits: s.visits + 1 };
      write(next);
      return next;
    });
  }, [anonymous]);

  if (!anonymous || !characters || !plans || !journal || state.dismissals >= MAX_DISMISSALS) return null;

  const due = [
    characters.length > 0 && 'first-character',
    (plans.length > 0 || journal.length > 0) && 'first-plan-or-entry',
    state.visits >= 5 && state.visits % 5 === 0 && `visit-${state.visits}`,
  ].filter((r): r is string => !!r && !state.answered.includes(r));
  const reminder = due.at(-1);
  if (!reminder) return null;

  const answer = (dismissed: boolean) => {
    const next = {
      ...state,
      dismissals: state.dismissals + (dismissed ? 1 : 0),
      answered: [...state.answered, ...due],
    };
    write(next);
    setState(next);
  };

  return (
    <section className="tip save-reminder" aria-label="Save your account">
      <p>
        <strong>Your journal is only tied to this browser.</strong> Save it with your email so clearing browser data or switching
        devices never loses it.
      </p>
      <div className="row-gap">
        <button type="button" className="btn2 sm" onClick={() => answer(true)}>
          Not now
        </button>
        <button
          type="button"
          className="btn sm"
          onClick={() => {
            answer(false);
            open({ kind: 'account', step: 'save' });
          }}
        >
          Save your account
        </button>
      </div>
    </section>
  );
}

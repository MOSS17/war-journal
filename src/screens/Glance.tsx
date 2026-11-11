import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Avatar, Bar, Rivets } from '../components/ui';
import { Mark } from '../components/icons';
import { useOverlay } from '../components/overlay';
import { PlanMini, nextCountdown } from '../components/domain';
import { useEvents, usePlanContext, usePlans } from '../db/hooks';
import { logMoment } from '../db/actions';
import { daysBetween, formatDate, fullName, planProgress, todayISO } from '../lib/logic';
import { CLASS_COLOR } from '../lib/gamedata';
import { TonightList } from './WarBoard';

/** A 420px-wide view to keep on a second screen while playing. */
export function Glance() {
  const { open, toast } = useOverlay();
  const ctx = usePlanContext();
  const plans = usePlans();
  const events = useEvents();
  const [moment, setMoment] = useState<string | null>(null);
  const [today, setToday] = useState(todayISO());

  useEffect(() => {
    document.title = 'Glance · War Journal';
    // Roll the date over at midnight while the window stays open.
    const t = setInterval(() => setToday(todayISO()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!ctx || !plans || !events) return null;
  const active = ctx.characters.filter((c) => c.status === 'active');
  const main = active.find((c) => c.isMain) ?? active[0];
  const top = plans
    .filter((p) => p.status === 'active' && p.tracked)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((p) => ({ plan: p, prog: planProgress(p, ctx) }))[0];
  const next = nextCountdown(events, today);

  const saveMoment = async () => {
    if (!moment?.trim()) return;
    await logMoment(moment, main);
    setMoment(null);
    toast('Saved as a draft. Finish it in the Journal.');
  };

  return (
    <main className="glance">
      <Rivets />
      <div className="sect" style={{ padding: '0 6px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mark size={22} />
          <span className="eyebrow" style={{ fontSize: 13, letterSpacing: '.14em' }}>
            Tonight · {formatDate(today)}
          </span>
        </span>
        <Link to="/" className="linkbtn" style={{ fontSize: 13, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
          Full board →
        </Link>
      </div>

      {main ? (
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '0 6px' }}>
          <Avatar c={main} size={74} />
          <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="title" style={{ fontSize: 20, color: CLASS_COLOR[main.class] }}>
              {fullName(main)}
            </span>
            {main.level < 60 ? (
              <>
                <Bar pct={main.xpPct / 100} kind="xp" height={14} label="Experience" />
                <span className="tab" style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {main.xpPct}% to level {main.level + 1}
                </span>
              </>
            ) : (
              <span className="muted">Level 60</span>
            )}
          </div>
          <button type="button" className="btn2 sm" onClick={() => open({ kind: 'progress', characterId: main.id })}>
            Update
          </button>
        </div>
      ) : (
        <button type="button" className="btn" onClick={() => open({ kind: 'character' })}>
          Add your first character
        </button>
      )}

      <section className="tracker" style={{ gap: 4, padding: '14px 12px' }} aria-labelledby="g-tonight">
        <h2 id="g-tonight" className="title" style={{ fontSize: 19, marginBottom: 4 }}>
          Tonight's plan
        </h2>
        <TonightList compact />
      </section>

      {top && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 12px' }} aria-labelledby="g-top">
          <span id="g-top" className="eyebrow" style={{ letterSpacing: '.04em', textTransform: 'none', fontSize: 13 }}>
            Top plan
          </span>
          <PlanMini plan={top.plan} prog={top.prog} />
        </section>
      )}

      {next && (
        <div className="notice" style={{ transform: 'rotate(-1.5deg)', display: 'flex', gap: 14, alignItems: 'center', padding: '18px 16px 14px' }}>
          <span className="tack" aria-hidden="true" />
          <span className="big tab" style={{ fontSize: 44 }}>
            {daysBetween(today, next.date!)}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 700, fontSize: 17 }}>
              day{daysBetween(today, next.date!) === 1 ? '' : 's'} until {next.title.toLowerCase()}
            </span>
            <span className="order">{formatDate(next.date!, 'long')}</span>
          </span>
        </div>
      )}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {moment === null ? (
          <>
            <button type="button" className="btn" style={{ minHeight: 52, fontSize: 15 }} onClick={() => setMoment('')}>
              Log a moment
            </button>
            <span style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>Saves a quick journal line. Finish it later.</span>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMoment();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <label className="lab" htmlFor="g-moment">
              What just happened?
            </label>
            <textarea
              id="g-moment"
              className="inp journal-text"
              rows={3}
              autoFocus
              value={moment}
              onChange={(e) => setMoment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  saveMoment();
                } else if (e.key === 'Escape') setMoment(null);
              }}
            />
            <div className="row-gap" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn2" onClick={() => setMoment(null)}>
                Cancel
              </button>
              <button type="submit" className="btn" disabled={!moment.trim()}>
                Save line
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

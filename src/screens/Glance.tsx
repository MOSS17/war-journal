import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Avatar, Bar, DiffDot } from '../components/ui';
import { Mark } from '../components/icons';
import { useOverlay } from '../components/overlay';
import { nextCountdown } from '../components/domain';
import { useEvents, usePlanContext, usePlans } from '../db/hooks';
import { logMoment } from '../db/actions';
import { DIFFICULTY_COLOR, daysBetween, formatDate, fullName, planProgress, todayISO } from '../lib/logic';
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
      <div className="sect">
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mark size={22} />
          <span className="eyebrow" style={{ color: 'var(--link)' }}>
            Tonight · {formatDate(today)}
          </span>
        </span>
        <Link to="/" style={{ fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          Full board →
        </Link>
      </div>

      {main ? (
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Avatar c={main} size={64} />
          <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="disp" style={{ fontSize: 20, color: 'var(--bone-hi)' }}>
              {fullName(main)}
            </span>
            {main.level < 60 ? (
              <>
                <Bar pct={main.xpPct / 100} kind="xp" height={8} label="Experience" />
                <span className="tab" style={{ fontSize: 13, color: 'var(--ash)' }}>
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

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-labelledby="g-tonight">
        <span id="g-tonight" className="eyebrow">
          Tonight's plan
        </span>
        <TonightList compact />
      </section>

      {top && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-labelledby="g-top">
          <span id="g-top" className="eyebrow">
            Top plan
          </span>
          <Link to={`/plans?p=${top.plan.id}`} className="soft" style={{ padding: 14, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--bone)', textDecoration: 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <DiffDot d={top.prog.difficulty} />
              <span className="grow" style={{ fontWeight: 600 }}>
                {top.plan.title}
              </span>
              <span className="tab" style={{ fontSize: 13, color: 'var(--ash)' }}>
                {top.prog.label}
              </span>
            </span>
            <Bar pct={top.prog.pct} kind="plain" color={DIFFICULTY_COLOR[top.prog.difficulty]} height={4} label="Top plan progress" />
          </Link>
        </section>
      )}

      {next && (
        <div className="countdown-box">
          <span className="disp tab" style={{ fontSize: 38, lineHeight: 0.9, color: 'var(--bone-hi)' }}>
            {daysBetween(today, next.date!)}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600 }}>
              day{daysBetween(today, next.date!) === 1 ? '' : 's'} until {next.title.toLowerCase()}
            </span>
            <span style={{ fontSize: 13, color: '#f2b48a' }}>{formatDate(next.date!, 'long')}</span>
          </span>
        </div>
      )}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {moment === null ? (
          <>
            <button type="button" className="btn" style={{ minHeight: 52, fontSize: 16 }} onClick={() => setMoment('')}>
              Log a moment
            </button>
            <span style={{ textAlign: 'center', fontSize: 13, color: 'var(--dust)' }}>Saves a quick journal line. Finish it later.</span>
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

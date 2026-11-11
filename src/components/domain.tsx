import { Link } from 'react-router';
import type { Character, GameEvent, JournalEntry, WarPlan } from '../lib/types';
import { DIFFICULTY_COLOR, DIFFICULTY_LABEL, daysBetween, formatDate, fullName, type PlanProgress } from '../lib/logic';
import { Mark } from './icons';
import { ParchGrain } from './Skyline';
import { useImageUrl } from './useImageUrl';

/**
 * A tracked plan, drawn like the in-game quest tracker: "[34] Scarlet Monastery" in its
 * difficulty colour, with objective lines below. Done objectives turn green.
 */
export function PlanMini({ plan, prog }: { plan: WarPlan; prog: PlanProgress }) {
  const lvl = prog.level ?? plan.level;
  const lines = prog.objectives.length
    ? prog.objectives.map((o) => ({ key: o.id, text: o.text, done: o.done }))
    : [{ key: 'progress', text: prog.label, done: prog.done }];
  return (
    <Link to={`/plans?p=${plan.id}`} className="tq">
      <span className="tq-title" style={{ color: DIFFICULTY_COLOR[prog.difficulty] }}>
        {lvl ? <span className="tab">[{lvl}] </span> : null}
        {plan.title}
        <span className="sr-only"> · {DIFFICULTY_LABEL[prog.difficulty]}</span>
      </span>
      {lines.map((l) => (
        <span key={l.key} className={`tq-obj${l.done ? ' done' : ''}`}>
          - {l.text}
          {l.done && <span className="sr-only"> (done)</span>}
        </span>
      ))}
    </Link>
  );
}

function Shot({ id }: { id: string }) {
  const url = useImageUrl(id);
  return <div className="polaroid">{url && <img src={url} alt="Screenshot" />}</div>;
}

export function JournalPage({
  entry,
  character,
  tilt = 0,
  onEdit,
  compact = false,
  footer,
}: {
  entry: JournalEntry;
  character?: Character;
  tilt?: number;
  onEdit?: () => void;
  compact?: boolean;
  footer?: React.ReactNode;
}) {
  const shot = entry.imageIds[0];
  return (
    <article
      className={`parch${compact ? ' edged' : ''}`}
      style={{
        padding: compact ? '30px 34px' : '30px 34px 26px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '22px 30px',
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
      }}
    >
      <ParchGrain />
      <span className="tack" aria-hidden="true" />
      <span className="seal" aria-hidden="true">
        <Mark size={24} muted />
      </span>
      <div style={{ position: 'relative', flex: '999 1 380px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'baseline', paddingRight: 60 }}>
          <span className="eyebrow" style={{ letterSpacing: '.14em' }}>
            {compact && 'From the journal · '}
            {formatDate(entry.date)}
            {entry.level ? ` · Level ${entry.level}` : ''}
          </span>
          {character && !compact && (
            <span className="ink" style={{ fontSize: 14 }}>
              {fullName(character)}
            </span>
          )}
        </div>
        <h2 style={{ fontSize: 28, lineHeight: 1.15, textWrap: 'balance' }}>
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              style={{ all: 'unset', cursor: 'pointer' }}
              aria-label={`Edit entry: ${entry.title || 'Untitled'}`}
            >
              {entry.title || 'Untitled'}
            </button>
          ) : (
            entry.title || 'Untitled'
          )}
        </h2>
        {entry.body && <p className="entry-body">{entry.body}</p>}
        {entry.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {entry.tags.map((t) => (
              <span key={t} className="itag">
                {t}
              </span>
            ))}
          </div>
        )}
        {footer}
      </div>
      {shot && <Shot id={shot} />}
    </article>
  );
}

/** Days until an event, or its label when it has no date. */
export function eventWhen(e: GameEvent, today: string): { big: string; small: string; days?: number } {
  if (e.date) {
    const days = daysBetween(today, e.date);
    return { big: formatDate(e.date), small: formatDate(e.date, 'long'), days };
  }
  const label = e.dateLabel ?? formatDate(e.approxDate);
  return { big: label.split(' ')[0], small: e.detail ?? label };
}

export function upcoming(events: GameEvent[], today: string): GameEvent[] {
  // Undated events stay on the horizon until they get a date or are removed.
  return events.filter((e) => (e.date ? e.date >= today : true));
}

export function nextCountdown(events: GameEvent[], today: string) {
  return events
    .filter((e) => e.date && e.date >= today)
    .sort((a, b) => a.date!.localeCompare(b.date!))[0];
}

export function countdownText(e: GameEvent, today: string): string {
  const d = daysBetween(today, e.date!);
  return d === 0 ? 'Today' : d === 1 ? '1 day' : `${d} days`;
}

import { Link } from 'react-router';
import { GuideLinks } from './GuideLinks';
import { formatMoney, todayISO } from '../lib/logic';
import { upcomingMilestones, zonesForLevel, type Milestone } from '../lib/milestones';
import type { Character, Instance, InstanceProgress } from '../lib/types';

function Title({ m }: { m: Milestone }) {
  return m.instanceId ? <Link to={`/instances?i=${m.instanceId}`}>{m.title}</Link> : <>{m.title}</>;
}

function Row({ m, c, compact }: { m: Milestone; c: Character; compact?: boolean }) {
  const now = m.level <= c.level;
  return (
    <li className="next-row">
      <span className={`next-lvl${now ? ' now' : ''}`} aria-label={now ? 'Now' : `At level ${m.level}`}>
        {now ? 'Now' : m.level}
      </span>
      <span className="next-body">
        <span className="next-title">
          <Title m={m} />
          {m.copper ? <span className="help"> · {formatMoney(m.copper, { short: true })}</span> : null}
        </span>
        {!compact && <span className="help">{m.detail}</span>}
        {!compact && m.links.length > 0 && <GuideLinks links={m.links} category={m.kind === 'dungeon' ? 'Dungeons' : 'Wiki'} />}
      </span>
    </li>
  );
}

/** Upcoming trainer visits, unlocks and dungeons, then where to quest. */
export function WhatsNext({
  c,
  instances,
  progress,
  compact = false,
}: {
  c: Character;
  instances: Instance[];
  progress: InstanceProgress[];
  compact?: boolean;
}) {
  const all = upcomingMilestones(c, instances, progress, todayISO(), compact ? 99 : 5);
  // The compact card has room for two: prefer things to buy, then dungeons, then the rest.
  const rank = (m: Milestone) => (m.copper ? 0 : m.kind === 'dungeon' ? 1 : m.kind === 'unlock' ? 2 : 3);
  const list = compact
    ? [...all].sort((a, b) => rank(a) - rank(b) || a.level - b.level).slice(0, 2).sort((a, b) => a.level - b.level)
    : all;
  const zones = zonesForLevel(c, compact ? 1 : 3);
  return (
    <div className="next">
      {list.length > 0 && (
        <ul className="next-list" aria-label="Coming up">
          {list.map((m) => (
            <Row key={m.id} m={m} c={c} compact={compact} />
          ))}
        </ul>
      )}
      {zones.length > 0 && (
        <p className="next-zones">
          <span className="eyebrow">Where to quest</span>{' '}
          {zones.map((z, i) => (
            <span key={z.id}>
              {i > 0 && ', '}
              <Link to="/guide?tab=zones">{z.name}</Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

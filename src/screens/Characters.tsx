import { Link, Navigate, useParams } from 'react-router';
import { Page } from '../components/Shell';
import { Avatar, Bar, DiffDot, EmptyState, Frame, Money, Rivets, StatusPill } from '../components/ui';
import { PlanMini } from '../components/domain';
import { useOverlay } from '../components/overlay';
import { useInstances, useJournal, usePlanContext, usePlans, useProfessions } from '../db/hooks';
import { setMain } from '../db/actions';
import { CLASS_COLOR } from '../lib/gamedata';
import {
  DIFFICULTY_COLOR,
  difficulty,
  fitsLevel,
  formatDate,
  formatPlayed,
  fullName,
  isLocked,
  levelRange,
  planProgress,
  todayISO,
} from '../lib/logic';
import type { Character } from '../lib/types';

function RosterCard({ c, selected }: { c: Character; selected: boolean }) {
  return (
    <Link
      to={`/characters/${c.id}`}
      className="tip"
      aria-current={selected ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 14px',
        textDecoration: 'none',
        opacity: c.status === 'retired' ? 0.6 : 1,
        borderColor: selected ? 'var(--rim)' : undefined,
        boxShadow: selected ? '0 0 0 1px #000, 0 0 12px rgba(255,209,0,.35)' : undefined,
      }}
    >
      <Avatar c={c} size={52} quiet />
      <span className="grow" style={{ display: 'flex', flexDirection: 'column' }}>
        <span className="disp ellipsis" style={{ fontSize: 16, color: CLASS_COLOR[c.class] }}>
          {fullName(c)}
        </span>
        <span className="muted" style={{ fontSize: 14 }}>
          {c.race} {c.class}
        </span>
      </span>
      {c.isMain && <span className="pill main">Main</span>}
      {c.status === 'retired' && <span className="pill">Retired</span>}
    </Link>
  );
}

export function Characters() {
  const { id } = useParams();
  const { open } = useOverlay();
  const ctx = usePlanContext();

  if (!ctx) return null;
  const chars = ctx.characters;
  const active = chars.filter((c) => c.status === 'active');
  const selected = id ? chars.find((c) => c.id === id) : (active.find((c) => c.isMain) ?? chars[0]);
  if (id && !selected) return <Navigate to="/characters" replace />;

  return (
    <Page
      variant="characters"
      title="Characters"
      eyebrow={chars.length ? `${active.length} active${chars.length > active.length ? ` · ${chars.length - active.length} retired` : ''}` : 'Your warband'}
      actions={
        <button type="button" className="btn" onClick={() => open({ kind: 'character' })}>
          + New character
        </button>
      }
    >
      <div className="stack">
        {chars.length === 0 ? (
          <EmptyState
              framed
              title="No characters yet"
              action={
                <button type="button" className="btn" onClick={() => open({ kind: 'character' })}>
                  + Add your first character
                </button>
              }
            >
              Add your main first. You can roll alts and retire characters later.
            </EmptyState>
        ) : (
          <section aria-label="Roster" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 14 }}>
            {chars.map((c) => (
              <RosterCard key={c.id} c={c} selected={c.id === selected?.id} />
            ))}
          </section>
        )}
        {selected && <CharacterDetail c={selected} />}
      </div>
    </Page>
  );
}

function CharacterDetail({ c }: { c: Character }) {
  const { open } = useOverlay();
  const ctx = usePlanContext();
  const plans = usePlans();
  const instances = useInstances();
  const journal = useJournal();
  const profs = useProfessions(c.id, (a, b) =>
    a.kind !== b.kind ? (a.kind === 'primary' ? -1 : 1) : b.skill - a.skill,
  );
  if (!ctx || !plans || !instances || !journal || !profs) return null;

  const today = todayISO();
  const myPlans = plans
    .filter((p) => p.ownerId === c.id && p.status === 'active')
    .map((p) => ({ plan: p, prog: planProgress(p, ctx) }));
  const prog = new Map(ctx.progress.filter((p) => p.characterId === c.id).map((p) => [p.instanceId, p]));
  const dungeons = instances.filter((i) => i.kind === 'dungeon');
  const raids = instances.filter((i) => i.kind === 'raid');
  const runs = dungeons.filter((i) => prog.has(i.id) && prog.get(i.id)!.status !== 'not-run' || fitsLevel(i, c.level));
  const clearedN = dungeons.filter((i) => prog.get(i.id)?.status === 'cleared').length;
  const startedN = dungeons.filter((i) => prog.get(i.id)?.status === 'run').length;
  const entries = journal.filter((e) => e.characterId === c.id && !e.draft).slice(0, 3);
  const raidOpen = raids.find((r) => r.unlockDate)?.unlockDate;

  const runColor = (st?: string) => (st === 'cleared' ? 'var(--done)' : st === 'run' ? 'var(--started)' : 'var(--faint)');

  return (
    <>
      <section className="card" aria-label={fullName(c)} style={{ padding: '40px 28px 28px', display: 'flex', flexWrap: 'wrap', gap: '24px 40px', alignItems: 'center' }}>
        <Rivets />
        <h2 className="plaque" aria-hidden="true">
          Character Sheet
        </h2>
        <div style={{ flex: '1 1 380px', display: 'flex', gap: 20, alignItems: 'center', minWidth: 0 }}>
          <Avatar c={c} size={120} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <h2 className="title" style={{ fontSize: 'clamp(28px, 4vw, 34px)', lineHeight: 1.1, color: CLASS_COLOR[c.class] }}>
              {fullName(c)}
            </h2>
            <span style={{ fontSize: 17, textShadow: 'var(--shadow)' }}>
              {c.race} {c.class}
            </span>
            {c.guild && <span style={{ color: 'var(--done)', textShadow: 'var(--shadow)' }}>&lt;{c.guild}&gt;</span>}
            <div className="row-gap" style={{ gap: 6, marginTop: 4 }}>
              <span className="pill">{c.ruleset} ruleset</span>
              {c.isMain && <span className="pill main">Main</span>}
              {c.status === 'retired' && <span className="pill">Retired</span>}
            </div>
          </div>
        </div>
        <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="barlabel">
            <span>Experience</span>
            <span className="tab">{c.level >= 60 ? 'Max level' : `${c.xpPct}% to level ${c.level + 1}`}</span>
          </div>
          <Bar pct={c.level >= 60 ? 1 : c.xpPct / 100} kind="xp" label="Experience" />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="tip" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="eyebrow" style={{ letterSpacing: '.04em', textTransform: 'none' }}>
              Gold
            </span>
            <Money copper={c.copper} />
          </div>
          <div className="tip" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="eyebrow" style={{ letterSpacing: '.04em', textTransform: 'none' }}>
              Played
            </span>
            <span className="tab" style={{ fontSize: 18 }}>
              {formatPlayed(c.playedMinutes)}
            </span>
          </div>
        </div>
        <div className="row-gap">
          {c.status === 'active' && (
            <button type="button" className="btn" onClick={() => open({ kind: 'progress', characterId: c.id })}>
              Update progress
            </button>
          )}
          <button type="button" className="btn2" onClick={() => open({ kind: 'character', id: c.id })}>
            Edit
          </button>
          {c.status === 'active' && !c.isMain && (
            <button type="button" className="btn2 quiet" onClick={() => setMain(c.id)}>
              Make main
            </button>
          )}
        </div>
      </section>

      <div className="detail-grid">
        <div className="grid-auto detail-main">
          <Frame title="Professions" titleId="cd-prof" style={{ gap: 14 }}>
            {profs.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                <p className="muted">No professions logged yet.</p>
                {c.status === 'active' && (
                  <button type="button" className="btn2 sm" onClick={() => open({ kind: 'progress', characterId: c.id })}>
                    + Add professions
                  </button>
                )}
              </div>
            ) : (
              profs.map((p) => (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="disp" style={{ fontSize: 14, color: 'var(--label)' }}>
                    {p.name}{' '}
                    <span style={{ fontFamily: 'var(--f-ui)', fontWeight: 500, color: 'var(--muted)' }}>
                      · {p.kind === 'primary' ? 'Primary' : 'Secondary'}
                    </span>
                  </span>
                  <Bar pct={p.skill / 300} kind="skill" value={`${p.skill} / 300`} label={`${p.name} skill, ${p.skill} of 300`} />
                </div>
              ))
            )}
          </Frame>

          <section className="tracker" aria-labelledby="cd-plans" style={{ gap: 14 }}>
            <div className="panel-head">
              <h3 id="cd-plans">War plans</h3>
              <Link to="/plans">All plans</Link>
            </div>
            {myPlans.length ? (
              myPlans.map(({ plan, prog }) => <PlanMini key={plan.id} plan={plan} prog={prog} />)
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                <p className="muted">No active plans for {c.firstName}.</p>
                <button type="button" className="btn2 sm" onClick={() => open({ kind: 'plan', preset: { ownerId: c.id } })}>
                  + New plan
                </button>
              </div>
            )}
          </section>

          <Frame
            title="Journal"
            titleId="cd-journal"
            style={{ gap: 6 }}
            right={
              <Link to={`/journal?c=${c.id}`} className="linkbtn">
                All entries
              </Link>
            }
          >
            {entries.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                <p className="muted">No entries for {c.firstName} yet.</p>
                <button type="button" className="btn2 sm" onClick={() => open({ kind: 'journal', preset: { characterId: c.id } })}>
                  Write an entry
                </button>
              </div>
            ) : (
              entries.map((e) => (
                <button key={e.id} type="button" className="listrow" onClick={() => open({ kind: 'journal', id: e.id })}>
                  <span className="grow" style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="disp" style={{ fontSize: 16, color: 'var(--gold)' }}>
                      {e.title || 'Untitled'}
                    </span>
                    <span className="help">
                      {formatDate(e.date)}
                      {e.level ? ` · Level ${e.level}` : ''}
                    </span>
                  </span>
                </button>
              ))
            )}
          </Frame>
        </div>

        <section className="tip" aria-labelledby="cd-dungeons" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div className="panel-head" style={{ marginBottom: 8 }}>
            <h3 id="cd-dungeons" style={{ fontSize: 22 }}>
              Dungeons
            </h3>
            <span className="tab" style={{ fontSize: 14, color: '#c8c8d0' }}>
              {clearedN} cleared · {startedN} started
            </span>
          </div>
          {runs.length === 0 && <p className="muted">No dungeons logged or in range yet.</p>}
          {runs.map((i) => {
            const r = prog.get(i.id);
            const extra =
              r?.status === 'cleared'
                ? r.firstClearDate
                  ? `First clear ${formatDate(r.firstClearDate)}${r.timesRun > 1 ? ` · run ${r.timesRun}×` : ''}`
                  : `Run ${r.timesRun}×`
                : r?.status === 'run'
                  ? r.wingsCleared.length
                    ? r.wingsCleared.join(', ')
                    : 'Partial clear'
                  : `${i.isNewInForever ? 'New · ' : ''}${levelRange(i)}`;
            const d = difficulty(i.levelMin, i.levelMax, c.level);
            return (
              <button
                key={i.id}
                type="button"
                className="listrow"
                onClick={() => open({ kind: 'instanceProgress', instanceId: i.id, characterId: c.id })}
              >
                <DiffDot d={d} glow={false} />
                <span className="grow" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 700, color: DIFFICULTY_COLOR[d], textShadow: 'var(--shadow)' }}>{i.name}</span>
                  <span style={{ fontSize: 13, color: 'var(--faint)' }}>{extra}</span>
                </span>
                <StatusPill status={r?.status ?? 'not-run'} />
              </button>
            );
          })}
          <span className="eyebrow" style={{ marginTop: 16, letterSpacing: '.04em', textTransform: 'none', fontSize: 13 }}>
            Raids{raidOpen && raidOpen > today ? ` · open ${formatDate(raidOpen)}` : ''}
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 8 }}>
            {raids.map((r) => {
              const p = prog.get(r.id);
              const locked = isLocked(r, today);
              const st = locked ? undefined : p?.status;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => open({ kind: 'instanceProgress', instanceId: r.id, characterId: c.id })}
                  className="soft"
                  style={{ padding: 12, minHeight: 44, display: 'flex', flexDirection: 'column', gap: 2, color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}
                >
                  <span className="disp" style={{ fontSize: 14, color: 'var(--body)' }}>
                    {r.name}
                  </span>
                  <span style={{ fontSize: 12, color: runColor(st) }}>
                    {r.size} player{locked ? ' · locked' : p && p.status !== 'not-run' ? ` · ${p.status === 'cleared' ? 'cleared' : 'started'}` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

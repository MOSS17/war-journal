import { Link, Navigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Page } from '../components/Shell';
import { Avatar, Bar, DiffDot, EmptyState, Money, SectionHead, StatusPill } from '../components/ui';
import { PlanMini } from '../components/domain';
import { useOverlay } from '../components/overlay';
import { db } from '../db/db';
import { useInstances, useJournal, usePlanContext, usePlans } from '../db/hooks';
import { setMain } from '../db/actions';
import { CLASS_COLOR } from '../lib/gamedata';
import {
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
      className="card"
      aria-current={selected ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        textDecoration: 'none',
        color: 'var(--bone)',
        opacity: c.status === 'retired' ? 0.6 : 1,
        boxShadow: selected ? 'inset 0 0 0 1.5px rgba(224,118,58,.55), 0 24px 48px -24px rgba(0,0,0,.7)' : undefined,
      }}
    >
      <Avatar c={c} size={48} quiet />
      <span className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="ellipsis" style={{ fontWeight: 700, fontSize: 16 }}>
          {fullName(c)}
        </span>
        <span style={{ fontSize: 14, color: 'var(--ash)' }}>
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
          <section className="card">
            <EmptyState
              title="No characters yet"
              action={
                <button type="button" className="btn" onClick={() => open({ kind: 'character' })}>
                  + Add your first character
                </button>
              }
            >
              Add your main first. You can roll alts and retire characters later.
            </EmptyState>
          </section>
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
  const profs = useLiveQuery(
    async () =>
      (await db.professions.where('characterId').equals(c.id).toArray()).sort((a, b) =>
        a.kind !== b.kind ? (a.kind === 'primary' ? -1 : 1) : b.skill - a.skill,
      ),
    [c.id],
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

  return (
    <>
      <section className="card" aria-label={fullName(c)} style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: 28,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px 40px',
            alignItems: 'center',
            background: `radial-gradient(ellipse 60% 140% at 0% 0%, ${CLASS_COLOR[c.class]}29, transparent 60%), radial-gradient(ellipse 50% 120% at 100% 100%, rgba(184,50,42,.16), transparent 60%)`,
          }}
        >
          <div style={{ flex: '1 1 380px', display: 'flex', gap: 20, alignItems: 'center', minWidth: 0 }}>
            <Avatar c={c} size={104} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <h2 className="disp" style={{ fontSize: 'clamp(28px, 4vw, 36px)', lineHeight: 1.05, color: 'var(--bone-hi)' }}>
                {c.firstName} <span style={{ color: 'var(--brass)' }}>{c.lastName}</span>
              </h2>
              <span style={{ color: '#d9cdb8', fontSize: 16 }}>
                {c.race} {c.class}
                {c.guild ? ` · <${c.guild}>` : ''}
              </span>
              <div className="row-gap" style={{ gap: 6 }}>
                <span className="pill">{c.ruleset} ruleset</span>
                {c.isMain && <span className="pill main">Main</span>}
                {c.status === 'retired' && <span className="pill">Retired</span>}
              </div>
            </div>
          </div>
          <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="barlabel">
              <span style={{ fontWeight: 600 }}>Experience</span>
              <span className="tab muted">{c.level >= 60 ? 'Max level' : `${c.xpPct}% to level ${c.level + 1}`}</span>
            </div>
            <Bar pct={c.level >= 60 ? 1 : c.xpPct / 100} kind="xp" height={10} label="Experience" />
          </div>
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="eyebrow" style={{ fontSize: 11 }}>
                Gold
              </span>
              <Money copper={c.copper} size={24} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="eyebrow" style={{ fontSize: 11 }}>
                Played
              </span>
              <span className="disp tab" style={{ fontSize: 24, color: 'var(--bone-hi)' }}>
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
        </div>
      </section>

      <div className="detail-grid">
        <div className="grid-auto detail-main">
        <section className="card card-pad" aria-labelledby="cd-prof" style={{ gap: 16 }}>
          <SectionHead as="h3" id="cd-prof" title="Professions" />
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
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="barlabel" style={{ fontSize: 15 }}>
                  <span>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>{' '}
                    <span style={{ fontSize: 13, color: 'var(--dust)' }}>{p.kind === 'primary' ? 'Primary' : 'Secondary'}</span>
                  </span>
                  <span className="tab muted">{p.skill} / 300</span>
                </div>
                <Bar pct={p.skill / 300} label={`${p.name} skill`} />
              </div>
            ))
          )}
        </section>

        <section className="card card-pad" aria-labelledby="cd-plans" style={{ gap: 12 }}>
          <SectionHead
            as="h3"
            id="cd-plans"
            title="War plans"
            right={
              <Link to="/plans" className="linkbtn">
                All plans
              </Link>
            }
          />
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

        <section className="card card-pad" aria-labelledby="cd-journal" style={{ gap: 10 }}>
          <SectionHead
            as="h3"
            id="cd-journal"
            title="Journal"
            right={
              <Link to={`/journal?c=${c.id}`} className="linkbtn">
                All entries
              </Link>
            }
          />
          {entries.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
              <p className="muted">No entries for {c.firstName} yet.</p>
              <button type="button" className="btn2 sm" onClick={() => open({ kind: 'journal', preset: { characterId: c.id } })}>
                Write an entry
              </button>
            </div>
          ) : (
            entries.map((e) => (
              <button
                key={e.id}
                type="button"
                className="listrow"
                onClick={() => open({ kind: 'journal', id: e.id })}
                style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid rgba(233,200,150,.07)', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }}
              >
                <span className="grow" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="disp" style={{ fontSize: 17 }}>
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
        </section>
        </div>
        <section className="card card-pad" aria-labelledby="cd-dungeons" style={{ gap: 4 }}>
          <div style={{ marginBottom: 10 }}>
            <SectionHead
              as="h3"
              id="cd-dungeons"
              title="Dungeons"
              right={
                <span className="tab muted" style={{ fontSize: 14 }}>
                  {clearedN} cleared · {startedN} started
                </span>
              }
            />
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
            return (
              <button
                key={i.id}
                type="button"
                className="listrow"
                onClick={() => open({ kind: 'instanceProgress', instanceId: i.id, characterId: c.id })}
                style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid rgba(233,200,150,.07)', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }}
              >
                <DiffDot d={difficulty(i.levelMin, i.levelMax, c.level)} glow={false} />
                <span className="grow" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600 }}>{i.name}</span>
                  <span style={{ fontSize: 13, color: 'var(--dust)' }}>{extra}</span>
                </span>
                <StatusPill status={r?.status ?? 'not-run'} />
              </button>
            );
          })}
          <span className="eyebrow" style={{ marginTop: 16 }}>
            Raids{raidOpen && raidOpen > today ? ` · open ${formatDate(raidOpen)}` : ''}
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 8 }}>
            {raids.map((r) => {
              const p = prog.get(r.id);
              const locked = isLocked(r, today);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => open({ kind: 'instanceProgress', instanceId: r.id, characterId: c.id })}
                  className="soft"
                  style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 2, border: 0, color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--dust)' }}>
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

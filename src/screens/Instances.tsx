import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Page } from '../components/Shell';
import { ClassDot, DiffDot, Segmented, StatusPill } from '../components/ui';
import { Icon } from '../components/icons';
import { useOverlay } from '../components/overlay';
import { db } from '../db/db';
import { updateInstance } from '../db/actions';
import { useInstances, usePlanContext } from '../db/hooks';
import {
  DIFFICULTY_COLOR,
  DIFFICULTY_LABEL,
  daysBetween,
  difficulty,
  fitsLevel,
  formatDate,
  isLocked,
  levelRange,
  levelRelation,
  todayISO,
} from '../lib/logic';
import type { Character, Instance, InstanceProgress } from '../lib/types';

type Kind = 'all' | 'dungeon' | 'raid';

export function Instances() {
  const { open } = useOverlay();
  const [params, setParams] = useSearchParams();
  const ctx = usePlanContext();
  const instances = useInstances();
  const detailRef = useRef<HTMLElement>(null);

  if (!ctx || !instances) return null;
  const today = todayISO();
  const active = ctx.characters.filter((c) => c.status === 'active');
  const char = active.find((c) => c.id === params.get('c')) ?? active.find((c) => c.isMain) ?? active[0];
  const kind = (params.get('kind') as Kind) || 'all';
  const fitsOn = !!char && params.get('fits') !== '0';
  const newOnly = params.get('new') === '1';

  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v === null) next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  const progress = new Map<string, InstanceProgress>(
    ctx.progress.filter((p) => p.characterId === char?.id).map((p) => [p.instanceId, p]),
  );

  const shown = instances.filter(
    (i) =>
      (kind === 'all' || i.kind === kind) &&
      (!newOnly || i.isNewInForever) &&
      (!fitsOn || i.kind === 'raid' || fitsLevel(i, char!.level) || (progress.get(i.id)?.status ?? 'not-run') !== 'not-run'),
  );
  const dungeons = shown.filter((i) => i.kind === 'dungeon');
  const raids = shown.filter((i) => i.kind === 'raid');
  const counts = {
    d: instances.filter((i) => i.kind === 'dungeon').length,
    r: instances.filter((i) => i.kind === 'raid').length,
    n: instances.filter((i) => i.isNewInForever && i.kind === 'dungeon').length,
  };

  const selected =
    instances.find((i) => i.id === params.get('i')) ??
    dungeons.find((i) => char && fitsLevel(i, char.level) && progress.get(i.id)?.status !== 'cleared') ??
    shown[0];

  const select = (id: string) => {
    set('i', id);
    if (window.matchMedia('(max-width: 1020px)').matches) {
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  };

  const raidUnlock = raids.find((r) => isLocked(r, today))?.unlockDate;

  const row = (i: Instance) => {
    const rec = progress.get(i.id);
    const st = rec?.status ?? 'not-run';
    const d = char ? difficulty(i.levelMin, i.levelMax, char.level) : 'even';
    const dim = char && !fitsLevel(i, char.level) && st === 'not-run' && i.kind === 'dungeon';
    const locked = isLocked(i, today);
    const partial = st === 'run' && i.wings.length ? `${rec!.wingsCleared.length} of ${i.wings.length}` : undefined;
    return (
      <button
        key={i.id}
        type="button"
        className="irow"
        aria-current={selected?.id === i.id}
        onClick={() => select(i.id)}
        style={{ opacity: dim ? 0.55 : 1 }}
      >
        <span className="name">
          {char ? <DiffDot d={d} size={8} /> : <span className="dot" style={{ background: 'var(--dust)' }} />}
          <span className="ellipsis">{i.name}</span>
          {i.isNewInForever && <span className="pill new sm">New</span>}
        </span>
        <span className="zone ellipsis">{i.zone}</span>
        <span className="num">{levelRange(i)}</span>
        <span className="num size" style={{ color: 'var(--dust)' }}>
          {i.size}
        </span>
        <span style={{ justifySelf: 'start' }}>{char ? <StatusPill status={st} locked={locked} label={partial} /> : locked ? <StatusPill status="not-run" locked /> : null}</span>
      </button>
    );
  };

  return (
    <Page
      variant="instances"
      title="Instances"
      eyebrow={`${counts.d} dungeons · ${counts.r} raids · ${counts.n} new in Forever`}
      actions={
        <button type="button" className="btn2" onClick={() => open({ kind: 'instance' })}>
          + Add instance
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="row-gap" style={{ gap: '10px 12px' }}>
          <Segmented
            label="Kind"
            inline
            value={kind}
            onChange={(v) => set('kind', v === 'all' ? null : v)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'dungeon', label: 'Dungeons' },
              { value: 'raid', label: 'Raids' },
            ]}
          />
          {char && (
            <button type="button" className="tog" aria-pressed={fitsOn} onClick={() => set('fits', fitsOn ? '0' : null)}>
              {fitsOn && <Icon.check size={14} />}
              Fits level {char.level}
            </button>
          )}
          <button type="button" className="tog" aria-pressed={newOnly} onClick={() => set('new', newOnly ? null : '1')}>
            {newOnly && <Icon.check size={14} />}
            New in Forever
          </button>
          {active.length > 0 && (
            <label htmlFor="inst-char" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, color: 'var(--ash)' }}>Progress for</span>
              <select id="inst-char" className="inp" style={{ width: 'auto', minHeight: 44 }} value={char?.id} onChange={(e) => set('c', e.target.value)}>
                {active.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} · {c.level}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="split">
          <section className="card" aria-label="Instance list" style={{ flex: '999 1 660px', minWidth: 0, padding: '6px 0' }}>
            <div className="irow head" role="presentation">
              <span className="eyebrow">Instance</span>
              <span className="eyebrow zone">Zone</span>
              <span className="eyebrow">Levels</span>
              <span className="eyebrow size">Size</span>
              <span className="eyebrow">{char ? char.firstName : 'Status'}</span>
            </div>
            {dungeons.map(row)}
            {dungeons.length === 0 && kind !== 'raid' && (
              <p className="muted" style={{ padding: '16px 20px' }}>
                No dungeons match these filters.
              </p>
            )}
            {raids.length > 0 && (
              <>
                <div style={{ padding: '18px 20px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="eyebrow">Raids</span>
                  {raidUnlock && (
                    <span className="pill main">
                      Open {formatDate(raidUnlock)} · {daysBetween(today, raidUnlock)} days
                    </span>
                  )}
                </div>
                {raids.map(row)}
              </>
            )}
          </section>

          <aside ref={detailRef} className="card" aria-label="Selected instance" style={{ flex: '1 1 340px', padding: 0, overflow: 'hidden', minWidth: 0, scrollMarginTop: 16 }}>
            {selected ? (
              <InstanceDetail inst={selected} char={char} chars={active} progress={ctx.progress} />
            ) : (
              <p className="muted" style={{ padding: 24 }}>
                Pick an instance to see its details.
              </p>
            )}
          </aside>
        </div>
      </div>
    </Page>
  );
}

function InstanceDetail({
  inst,
  char,
  chars,
  progress,
}: {
  inst: Instance;
  char?: Character;
  chars: Character[];
  progress: InstanceProgress[];
}) {
  const { open } = useOverlay();
  const today = todayISO();
  const links = useLiveQuery(() => db.library.where('instanceId').equals(inst.id).toArray(), [inst.id]);
  const [notes, setNotes] = useState(inst.notes);
  useEffect(() => {
    setNotes(inst.notes);
  }, [inst.id, inst.notes]);
  const d = char ? difficulty(inst.levelMin, inst.levelMax, char.level) : null;
  const locked = isLocked(inst, today);

  return (
    <>
      <div
        style={{
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: 'radial-gradient(ellipse 90% 120% at 100% 0%, rgba(184,50,42,.24), transparent 60%)',
          borderBottom: '1px solid rgba(233,200,150,.08)',
        }}
      >
        <div className="row-gap" style={{ gap: 6 }}>
          {inst.isNewInForever && <span className="pill new">New in Forever</span>}
          {locked && <span className="pill locked">Opens {formatDate(inst.unlockDate!)}</span>}
          {d && char && (
            <span className="pill" style={{ background: `${DIFFICULTY_COLOR[d]}24`, color: DIFFICULTY_COLOR[d] }}>
              <DiffDot d={d} size={7} glow={false} />
              {DIFFICULTY_LABEL[d]} for {char.firstName}
            </span>
          )}
        </div>
        <div className="sect" style={{ alignItems: 'flex-start' }}>
          <h2 className="disp" style={{ fontSize: 30, lineHeight: 1.05, color: 'var(--bone-hi)' }}>
            {inst.name}
          </h2>
          <button type="button" className="iconbtn" aria-label={`Edit ${inst.name}`} onClick={() => open({ kind: 'instance', id: inst.id })}>
            <Icon.edit size={16} />
          </button>
        </div>
        <span className="muted">
          {inst.kind === 'raid' ? 'Raid' : 'Dungeon'} · {inst.size} player · {inst.zone} · <span style={{ whiteSpace: 'nowrap' }}>{levelRange(inst)}</span>
        </span>
      </div>
      <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {chars.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="eyebrow">Your characters</span>
            {chars.map((c) => {
              const rec = progress.find((p) => p.characterId === c.id && p.instanceId === inst.id);
              const rel = levelRelation(inst, c.level);
              const txt =
                rec?.status === 'cleared'
                  ? 'Cleared'
                  : rec?.status === 'run'
                    ? inst.wings.length
                      ? `${rec.wingsCleared.length} of ${inst.wings.length} wings`
                      : 'Started'
                    : rel.text;
              const color = rec?.status === 'cleared' ? 'var(--ok)' : rec?.status === 'run' ? 'var(--warn)' : rel.tone === 'deadly' || rel.tone === 'trivial' ? 'var(--dust)' : DIFFICULTY_COLOR[rel.tone];
              return (
                <button
                  key={c.id}
                  type="button"
                  className="listrow"
                  onClick={() => open({ kind: 'instanceProgress', instanceId: inst.id, characterId: c.id })}
                  style={{ justifyContent: 'space-between', background: 'none', border: 0, borderBottom: '1px solid rgba(233,200,150,.07)', color: 'inherit', font: 'inherit', cursor: 'pointer', width: '100%' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ClassDot c={c} />
                    <span style={{ fontWeight: 600 }}>
                      {c.firstName} · {c.level}
                    </span>
                  </span>
                  <span style={{ fontSize: 14, color }}>{txt}</span>
                </button>
              );
            })}
          </div>
        )}

        {inst.wings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="eyebrow">Wings</span>
            <div className="row-gap" style={{ gap: 6 }}>
              {inst.wings.map((w) => {
                const done = progress.some((p) => p.characterId === char?.id && p.instanceId === inst.id && (p.status === 'cleared' || p.wingsCleared.includes(w)));
                return (
                  <span key={w} className={`pill ${done ? 'cleared' : ''}`}>
                    {w}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="eyebrow">Bosses</span>
          {inst.bosses.length ? (
            <div className="row-gap" style={{ gap: 6 }}>
              {inst.bosses.map((b) => (
                <span key={b} className="pill">
                  {b}
                </span>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: 14, color: 'var(--ash)' }}>
              Not confirmed yet.{' '}
              <button type="button" className="linkbtn" onClick={() => open({ kind: 'instance', id: inst.id })}>
                Add them as you meet them.
              </button>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="eyebrow" htmlFor={`notes-${inst.id}`}>
            My notes
          </label>
          <textarea
            id={`notes-${inst.id}`}
            className="inp"
            rows={3}
            placeholder="Entrance quest? Keys? Who to bring?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== inst.notes && updateInstance(inst.id, { notes })}
            style={{ fontSize: 15, background: 'rgba(233,200,150,.04)' }}
          />
          <span className="help">Saves when you click away.</span>
        </div>

        {(inst.guideLinks.length > 0 || (links && links.length > 0)) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="eyebrow">Guides &amp; Library</span>
            {inst.guideLinks.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, textDecoration: 'none' }}>
                {l.title || l.url} →
              </a>
            ))}
            {links?.map((l) =>
              l.kind === 'link' && l.url ? (
                <a key={l.id} href={l.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, textDecoration: 'none' }}>
                  {l.title} →
                </a>
              ) : (
                <button key={l.id} type="button" className="linkbtn" style={{ textAlign: 'left', fontSize: 16 }} onClick={() => open({ kind: 'library', id: l.id })}>
                  {l.title} (note)
                </button>
              ),
            )}
          </div>
        )}

        <div className="row-gap">
          <button type="button" className="btn" onClick={() => open({ kind: 'instanceProgress', instanceId: inst.id, characterId: char?.id })}>
            Mark progress
          </button>
          <button type="button" className="btn2" onClick={() => open({ kind: 'plan', preset: { instanceId: inst.id, ownerId: char?.id } })}>
            + War plan
          </button>
          <button type="button" className="btn2 quiet" onClick={() => open({ kind: 'library', preset: { instanceId: inst.id } })}>
            + Save a guide
          </button>
        </div>
      </div>
    </>
  );
}

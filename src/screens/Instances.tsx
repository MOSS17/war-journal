import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Page } from '../components/Shell';
import { Check, ClassDot, Rivets, Segmented, StatusPill } from '../components/ui';
import { Icon } from '../components/icons';
import { ParchGrain } from '../components/Skyline';
import { useOverlay } from '../components/overlay';
import { db } from '../db/db';
import { toggleQuest, updateInstance } from '../db/actions';
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
import type { Character, Instance, InstanceProgress, InstanceQuest, Territory } from '../lib/types';

export const TERRITORY_LABEL: Record<Territory, string> = {
  horde: 'Horde territory',
  contested: 'Contested',
  alliance: 'Alliance territory',
};

const QUEST_KIND_LABEL: Record<InstanceQuest['kind'], string | null> = { quest: null, key: 'Key', attunement: 'Attunement' };

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
  const hideAlly = params.get('ally') === '0';

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
      (!hideAlly || i.territory !== 'alliance') &&
      (!fitsOn || i.kind === 'raid' || fitsLevel(i, char!.level) || (progress.get(i.id)?.status ?? 'not-run') !== 'not-run'),
  );
  const dungeons = shown.filter((i) => i.kind === 'dungeon');
  const hordeSide = dungeons.filter((i) => i.territory !== 'alliance');
  const allySide = dungeons.filter((i) => i.territory === 'alliance');
  const raids = shown.filter((i) => i.kind === 'raid');
  const counts = {
    d: instances.filter((i) => i.kind === 'dungeon').length,
    r: instances.filter((i) => i.kind === 'raid').length,
    n: instances.filter((i) => i.isNewInForever && i.kind === 'dungeon').length,
    h: instances.filter((i) => i.kind === 'dungeon' && i.territory !== 'alliance').length,
  };

  const selected =
    instances.find((i) => i.id === params.get('i')) ??
    hordeSide.find((i) => char && fitsLevel(i, char.level) && progress.get(i.id)?.status !== 'cleared') ??
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
          <span className="ellipsis" style={{ color: char ? DIFFICULTY_COLOR[d] : 'var(--body)' }}>
            {i.name}
            {char && <span className="sr-only"> · {DIFFICULTY_LABEL[d]}</span>}
          </span>
          {i.isNewInForever && <span className="pill new sm">New</span>}
          {i.territory === 'alliance' && <span className="pill ally sm">Alliance land</span>}
        </span>
        <span className="zone ellipsis">{i.zone}</span>
        <span className="num">{levelRange(i)}</span>
        <span className="num size">{i.size}</span>
        <span style={{ justifySelf: 'start' }}>{char ? <StatusPill status={st} locked={locked} label={partial} /> : locked ? <StatusPill status="not-run" locked /> : null}</span>
      </button>
    );
  };

  return (
    <Page
      variant="instances"
      title="Instances"
      eyebrow={`${counts.d} dungeons · ${counts.h} Horde-friendly · ${counts.r} raids · ${counts.n} new in Forever`}
      actions={
        <button type="button" className="btn2" onClick={() => open({ kind: 'instance' })}>
          + Add instance
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
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
          <button type="button" className="tog" aria-pressed={hideAlly} onClick={() => set('ally', hideAlly ? null : '0')}>
            {hideAlly && <Icon.check size={14} />}
            Hide Alliance side
          </button>
          {active.length > 0 && (
            <label htmlFor="inst-char" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="lab">Progress for</span>
              <select id="inst-char" className="inp" style={{ width: 'auto' }} value={char?.id} onChange={(e) => set('c', e.target.value)}>
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
          <section className="card" aria-label="Instance list" style={{ flex: '999 1 660px', minWidth: 0, padding: '40px 16px 18px' }}>
            <Rivets />
            <h2 className="plaque" aria-hidden="true">
              Dungeon Finder
            </h2>
            <div className="well" style={{ overflowX: 'auto', padding: '6px 0' }}>
            <div style={{ minWidth: 'min(600px, 100%)' }}>
            <div className="irow head" role="presentation">
              <span className="eyebrow">Instance</span>
              <span className="eyebrow zone">Zone</span>
              <span className="eyebrow">Levels</span>
              <span className="eyebrow size">Size</span>
              <span className="eyebrow">{char ? char.firstName : 'Status'}</span>
            </div>
            {hordeSide.length > 0 && (
              <div className="group-head">
                <span className="eyebrow">Horde &amp; contested</span>
              </div>
            )}
            {hordeSide.map(row)}
            {allySide.length > 0 && (
              <div className="group-head" style={{ paddingTop: 18 }}>
                <span className="eyebrow">Alliance territory</span>
                <span className="help">Possible as Horde, but you’ll travel through enemy land.</span>
              </div>
            )}
            {allySide.map(row)}
            {dungeons.length === 0 && kind !== 'raid' && (
              <p className="muted" style={{ padding: '16px 14px' }}>
                No dungeons match these filters.
              </p>
            )}
            {raids.length > 0 && (
              <>
                <div className="group-head" style={{ paddingTop: 18 }}>
                  <span className="eyebrow">Raids</span>
                  {raidUnlock && (
                    <span className="disp" style={{ fontSize: 13, color: '#ff8040' }}>
                      · Open {formatDate(raidUnlock)} · {daysBetween(today, raidUnlock)} days
                    </span>
                  )}
                </div>
                {raids.map(row)}
              </>
            )}
            </div>
            </div>
          </section>

          <aside ref={detailRef} className="parch edged" aria-label="Selected instance" style={{ flex: '1 1 340px', minWidth: 0, scrollMarginTop: 16 }}>
            <ParchGrain />
            {selected ? (
              <InstanceDetail inst={selected} char={char} chars={active} progress={ctx.progress} />
            ) : (
              <p className="muted" style={{ position: 'relative', padding: 26 }}>
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
      <div style={{ position: 'relative', padding: '28px 26px 6px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="eyebrow" style={{ letterSpacing: '.12em' }}>
          {inst.kind === 'raid' ? 'Raid' : 'Dungeon'} · {inst.size} player
        </span>
        <div className="sect" style={{ alignItems: 'flex-start' }}>
          <h2 style={{ fontSize: 30, lineHeight: 1.1 }}>{inst.name}</h2>
          <button type="button" className="iconbtn" aria-label={`Edit ${inst.name}`} onClick={() => open({ kind: 'instance', id: inst.id })}>
            <Icon.edit size={16} />
          </button>
        </div>
        <span style={{ fontFamily: 'var(--f-ink)', fontSize: 16 }}>
          {inst.zone} · <span style={{ whiteSpace: 'nowrap' }}>{levelRange(inst)}</span>
        </span>
        <div className="row-gap" style={{ gap: 6 }}>
          {inst.isNewInForever && <span className="pill">New in Forever</span>}
          {locked && <span className="pill">Opens {formatDate(inst.unlockDate!)}</span>}
          {d && char && (
            <span className="pill" style={{ color: DIFFICULTY_COLOR[d] }}>
              {DIFFICULTY_LABEL[d]} for {char.firstName}
            </span>
          )}
        </div>
      </div>
      <div style={{ position: 'relative', padding: '16px 26px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {chars.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h3>Your characters</h3>
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
              const qTotal = inst.quests.filter((q) => q.faction !== 'alliance').length;
              const qDone = rec ? inst.quests.filter((q) => q.faction !== 'alliance' && rec.questsDone.includes(q.id)).length : 0;
              const color =
                rec?.status === 'cleared' ? '#2d6a12' : rec?.status === 'run' ? '#7a5a0a' : rel.tone === 'hard' || rel.tone === 'deadly' ? '#8a3a0a' : 'var(--ink-soft)';
              return (
                <button
                  key={c.id}
                  type="button"
                  className="listrow"
                  onClick={() => open({ kind: 'instanceProgress', instanceId: inst.id, characterId: c.id })}
                  style={{ justifyContent: 'space-between', fontFamily: 'var(--f-ink)' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ClassDot c={c} />
                    <strong>
                      {c.firstName} · {c.level}
                    </strong>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color }}>
                    {txt}
                    {qTotal > 0 && <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}> · {qDone}/{qTotal} quests</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3>Getting in as Horde</h3>
          <div>
            <span className={`pill ${inst.territory === 'alliance' ? 'ally' : inst.territory === 'horde' ? 'horde' : ''}`}>{TERRITORY_LABEL[inst.territory]}</span>
          </div>
          {inst.hordeAccess && <p style={{ fontFamily: 'var(--f-ink)', fontSize: 16, margin: 0 }}>{inst.hordeAccess}</p>}
        </div>

        <QuestList inst={inst} char={char} progress={progress} />

        {inst.wings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3>Wings</h3>
            <div className="row-gap" style={{ gap: 6 }}>
              {inst.wings.map((w) => {
                const done = progress.some((p) => p.characterId === char?.id && p.instanceId === inst.id && (p.status === 'cleared' || p.wingsCleared.includes(w)));
                return (
                  <span key={w} className="pill" style={done ? { background: '#2d6a12', borderColor: '#2d6a12', color: '#fff' } : undefined}>
                    {w}
                    {done && <span className="sr-only"> (cleared)</span>}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3>Bosses</h3>
          {inst.bosses.length ? (
            <div className="row-gap" style={{ gap: 6 }}>
              {inst.bosses.map((b) => (
                <span key={b} className="pill">
                  {b}
                </span>
              ))}
            </div>
          ) : (
            <span style={{ fontFamily: 'var(--f-ink)', fontSize: 16 }}>
              Not confirmed yet.{' '}
              <button type="button" className="linkbtn" style={{ minHeight: 44 }} onClick={() => open({ kind: 'instance', id: inst.id })}>
                Add them as you meet them.
              </button>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor={`notes-${inst.id}`}>
            <h3>My notes</h3>
          </label>
          <textarea
            id={`notes-${inst.id}`}
            className="inp"
            rows={3}
            placeholder="Entrance quest? Keys? Who to bring?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== inst.notes && updateInstance(inst.id, { notes })}
          />
          <span className="help">Saves when you click away.</span>
        </div>

        {(inst.guideLinks.length > 0 || (links && links.length > 0)) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h3>Guides &amp; Library</h3>
            {inst.guideLinks.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
                {l.title || l.url} →
              </a>
            ))}
            {links?.map((l) =>
              l.kind === 'link' && l.url ? (
                <a key={l.id} href={l.url} target="_blank" rel="noreferrer">
                  {l.title} →
                </a>
              ) : (
                <button key={l.id} type="button" className="linkbtn" style={{ textAlign: 'left' }} onClick={() => open({ kind: 'library', id: l.id })}>
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

function QuestList({ inst, char, progress }: { inst: Instance; char?: Character; progress: InstanceProgress[] }) {
  const done = new Set(progress.find((p) => p.characterId === char?.id && p.instanceId === inst.id)?.questsDone ?? []);
  const mine = inst.quests.filter((q) => q.faction !== 'alliance');
  const ally = inst.quests.filter((q) => q.faction === 'alliance');
  const doneCount = mine.filter((q) => done.has(q.id)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="sect">
        <h3>Quests</h3>
        {char && mine.length > 0 && (
          <span className="help">
            {doneCount} of {mine.length} done for {char.firstName}
          </span>
        )}
      </div>
      {inst.quests.length === 0 && <span style={{ fontFamily: 'var(--f-ink)', fontSize: 16 }}>No quests confirmed yet.</span>}
      {inst.quests.length > 0 && mine.length === 0 && (
        <span style={{ fontFamily: 'var(--f-ink)', fontSize: 16 }}>No Horde quests for this one.</span>
      )}
      {mine.map((q) => (
        <div key={q.id} className="quest">
          {char ? (
            <Check checked={done.has(q.id)} onChange={(v) => toggleQuest(char.id, inst.id, q.id, v)}>
              <QuestTitle q={q} />
            </Check>
          ) : (
            <QuestTitle q={q} />
          )}
          <QuestBody q={q} />
        </div>
      ))}
      {ally.length > 0 && (
        <details className="quest-ally">
          <summary>Alliance-only quests ({ally.length})</summary>
          <p className="help" style={{ margin: '4px 0 8px' }}>
            A Horde character can’t pick these up. Shown so you know what Alliance groups are there for.
          </p>
          {ally.map((q) => (
            <div key={q.id} className="quest">
              <QuestTitle q={q} />
              <QuestBody q={q} />
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function QuestTitle({ q }: { q: InstanceQuest }) {
  const kind = QUEST_KIND_LABEL[q.kind];
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      <span style={{ fontWeight: 700 }}>{q.name}</span>
      {kind && <span className="pill main sm">{kind}</span>}
      {!q.confirmed && <span className="pill locked sm">Unconfirmed</span>}
    </span>
  );
}

function QuestBody({ q }: { q: InstanceQuest }) {
  return (
    <div className="quest-body">
      <span>
        {q.giver} · {q.location}
        {q.minLevel ? ` · level ${q.minLevel}+` : ''}
      </span>
      {q.prereq && <span>Requires: {q.prereq}</span>}
      <span style={{ color: 'var(--ink)' }}>{q.howTo}</span>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Modal, type ModalProps } from '../components/Modal';
import { Avatar, CoinsInput, EmptyState, Stepper, XpRange } from '../components/ui';
import { useOverlay } from '../components/overlay';
import { db } from '../db/db';
import { saveProgress } from '../db/actions';
import { sortCharacters } from '../db/hooks';
import { MAX_LEVEL, MAX_SKILL, PRIMARY_PROFESSIONS, SECONDARY_PROFESSIONS } from '../lib/gamedata';
import { formatMoney, formatMoneyDelta, fullName, uid } from '../lib/logic';
import type { Character, Profession, ProfessionKind } from '../lib/types';
import { ACCOUNT } from '../lib/types';

type ProfRow = Pick<Profession, 'id' | 'name' | 'kind' | 'skill'>;

export function ProgressForm({ characterId, onClose }: ModalProps & { characterId?: string }) {
  const { open, toast, celebrate } = useOverlay();
  const chars = useLiveQuery(async () => sortCharacters(await db.characters.toArray()).filter((c) => c.status === 'active'), []);
  const [charId, setCharId] = useState<string | undefined>(characterId);
  const char = chars?.find((c) => c.id === charId) ?? chars?.[0];

  useEffect(() => {
    if (!charId && chars?.[0]) setCharId(chars[0].id);
  }, [chars, charId]);

  if (chars && chars.length === 0) {
    return (
      <Modal title="Update progress" onClose={onClose} size="narrow">
        <div className="mb">
          <EmptyState
            title="No characters yet"
            action={
              <button type="button" className="btn" onClick={() => open({ kind: 'character' })}>
                Add your first character
              </button>
            }
          >
            Add a character first, then come back after a session to log levels, gold and professions.
          </EmptyState>
        </div>
      </Modal>
    );
  }
  if (!char) return null;
  return (
    <ProgressFormInner
      key={char.id}
      char={char}
      chars={chars!}
      onPick={setCharId}
      onClose={onClose}
      onSaved={(completed, entryTitle, writeEntry) => {
        toast(`Progress saved for ${char.firstName}`);
        celebrate(completed);
        if (writeEntry) open({ kind: 'journal', preset: { characterId: char.id, title: entryTitle } });
        else onClose();
      }}
    />
  );
}

function ProgressFormInner({
  char,
  chars,
  onPick,
  onClose,
  onSaved,
}: {
  char: Character;
  chars: Character[];
  onPick: (id: string) => void;
  onClose: () => void;
  onSaved: (completed: string[], entryTitle: string, writeEntry: boolean) => void;
}) {
  const initialProfs = useLiveQuery(() => db.professions.where('characterId').equals(char.id).toArray(), [char.id]);
  const goldPlans = useLiveQuery(
    async () =>
      (await db.plans.where('status').equals('active').toArray()).filter(
        (p) => p.type === 'gold' && (p.ownerId === char.id || p.ownerId === ACCOUNT),
      ),
    [char.id],
  );
  const others = useLiveQuery(
    async () => (await db.characters.toArray()).filter((c) => c.status === 'active' && c.id !== char.id).reduce((s, c) => s + c.copper, 0),
    [char.id],
  );

  const [level, setLevel] = useState(char.level);
  const [xp, setXp] = useState(char.xpPct);
  const [copper, setCopper] = useState(char.copper);
  const [days, setDays] = useState(Math.floor((char.playedMinutes ?? 0) / 1440));
  const [hours, setHours] = useState(Math.floor(((char.playedMinutes ?? 0) % 1440) / 60));
  const [profs, setProfs] = useState<ProfRow[] | null>(null);
  const [adding, setAdding] = useState('');

  useEffect(() => {
    if (initialProfs && profs === null) setProfs(initialProfs.map(({ id, name, kind, skill }) => ({ id, name, kind, skill })));
  }, [initialProfs, profs]);

  const before = useMemo(() => new Map((initialProfs ?? []).map((p) => [p.id, p.skill])), [initialProfs]);
  const list = profs ?? [];
  const primaries = list.filter((p) => p.kind === 'primary').length;
  const available = [
    ...PRIMARY_PROFESSIONS.map((n) => ({ name: n, kind: 'primary' as ProfessionKind })),
    ...SECONDARY_PROFESSIONS.map((n) => ({ name: n, kind: 'secondary' as ProfessionKind })),
  ].filter((p) => !list.some((x) => x.name === p.name));

  const dLevel = level - char.level;
  const dGold = copper - char.copper;

  const goldHint = goldPlans?.[0];
  const goldHave = goldHint ? copper + (goldHint.ownerId === ACCOUNT ? (others ?? 0) : 0) : 0;

  const save = async (writeEntry: boolean) => {
    const completed = await saveProgress(char.id, {
      level,
      xpPct: level >= MAX_LEVEL ? 0 : xp,
      copper,
      playedMinutes: days * 1440 + hours * 60 || char.playedMinutes,
      professions: list,
    });
    const title = dLevel > 0 ? `Level ${level}` : '';
    onSaved(completed, title, writeEntry);
  };

  return (
    <Modal
      title="Update progress"
      onClose={onClose}
      onSubmit={() => save(false)}
      size="wide"
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <Avatar c={char} size={48} showLevel={false} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            {chars.length > 1 ? (
              <label className="eyebrow" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="sr-only">Character</span>
                <select
                  className="inp"
                  style={{ fontSize: 15, width: 'auto' }}
                  value={char.id}
                  onChange={(e) => onPick(e.target.value)}
                >
                  {chars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {fullName(c)} · {c.level}
                    </option>
                  ))}
                </select>
                <span>after tonight's session</span>
              </label>
            ) : (
              <span className="eyebrow">{char.firstName} · after tonight's session</span>
            )}
          </div>
        </div>
      }
      footer={
        <>
          <span className="help">Changes since your last update are shown in green.</span>
          <div className="row-gap">
            <button type="button" className="btn2" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn2" onClick={() => save(true)}>
              Save and write entry
            </button>
            <button type="submit" className="btn">
              Save progress
            </button>
          </div>
        </>
      }
    >
      <div className="mb">
        <div className="three">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <span className="eyebrow">Level</span>
            <div className="field">
              <label className="lab" htmlFor="up-level">
                Level
              </label>
              <Stepper id="up-level" label="level" value={level} onChange={setLevel} min={1} max={MAX_LEVEL} />
              {dLevel > 0 ? (
                <span className="help ok">
                  +{dLevel} since last update. {dLevel === 1 ? 'Ding!' : 'Ding ding!'}
                </span>
              ) : dLevel < 0 ? (
                <span className="help bad">{dLevel} since last update</span>
              ) : (
                <span className="help">1 to {MAX_LEVEL}</span>
              )}
            </div>
            {level < MAX_LEVEL && (
              <div className="field" style={{ gap: 8 }}>
                <div className="barlabel">
                  <label className="lab" htmlFor="up-xp">
                    Experience into level
                  </label>
                  <span className="disp tab" style={{ color: 'var(--gold)' }}>
                    {xp}%
                  </span>
                </div>
                <XpRange id="up-xp" value={xp} onChange={setXp} />
              </div>
            )}
            <div className="field">
              <span className="lab" id="up-played">
                Time played <span className="opt">· optional</span>
              </span>
              <div className="two" role="group" aria-labelledby="up-played" style={{ gap: 8 }}>
                <Stepper label="days played" value={days} onChange={setDays} min={0} max={999} small />
                <Stepper label="hours played" value={hours} onChange={setHours} min={0} max={23} small />
              </div>
              <span className="help">Days and hours, from /played</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <span className="eyebrow">Gold</span>
            <CoinsInput legend="On hand" copper={copper} onChange={setCopper} />
            {(dGold !== 0 || goldHint) && (
              <span className={`help${dGold > 0 ? ' ok' : dGold < 0 ? ' bad' : ''}`}>
                {dGold !== 0 && formatMoneyDelta(dGold)}
                {dGold !== 0 && goldHint && ' · '}
                {goldHint &&
                  `${goldHint.title.toLowerCase()} now ${formatMoney(goldHave, { short: true })} / ${formatMoney(goldHint.target.copper ?? 0, { short: true })}`}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span className="eyebrow">Professions</span>
            {list.length === 0 && <span className="help">No professions yet.</span>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: '10px 8px', alignItems: 'center' }}>
              {list.map((p) => {
                const was = before.get(p.id);
                const d = was === undefined ? 0 : p.skill - was;
                return (
                  <div key={p.id} style={{ display: 'contents' }}>
                    <label className="lab" htmlFor={`up-p-${p.id}`} style={{ minWidth: 0 }}>
                      {p.name}
                      {d > 0 && <span className="help ok"> +{d}</span>}
                      {was === undefined && <span className="help ok"> new</span>}
                    </label>
                    <Stepper
                      id={`up-p-${p.id}`}
                      label={p.name}
                      value={p.skill}
                      onChange={(v) => setProfs(list.map((x) => (x.id === p.id ? { ...x, skill: v } : x)))}
                      min={0}
                      max={MAX_SKILL}
                      small
                    />
                    <button
                      type="button"
                      className="iconbtn"
                      aria-label={`Remove ${p.name}`}
                      onClick={() => setProfs(list.filter((x) => x.id !== p.id))}
                      style={{ width: 30, height: 30, fontSize: 16 }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            {available.length > 0 && (
              <div className="row-gap" style={{ gap: 8 }}>
                <label className="sr-only" htmlFor="up-addprof">
                  Add profession
                </label>
                <select id="up-addprof" className="inp" style={{ height: 38, flex: 1, minWidth: 140 }} value={adding} onChange={(e) => setAdding(e.target.value)}>
                  <option value="">Choose a profession…</option>
                  <optgroup label={`Primary${primaries >= 2 ? ' (2 max)' : ''}`}>
                    {available
                      .filter((p) => p.kind === 'primary')
                      .map((p) => (
                        <option key={p.name} value={p.name} disabled={primaries >= 2}>
                          {p.name}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Secondary">
                    {available
                      .filter((p) => p.kind === 'secondary')
                      .map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                  </optgroup>
                </select>
                <button
                  type="button"
                  className="btn2 sm"
                  disabled={!adding}
                  onClick={() => {
                    const def = available.find((a) => a.name === adding);
                    if (!def) return;
                    setProfs([...list, { id: uid(), name: def.name, kind: def.kind, skill: 1 }]);
                    setAdding('');
                  }}
                >
                  + Add profession
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

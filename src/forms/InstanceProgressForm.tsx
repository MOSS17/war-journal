import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Modal, type ModalProps } from '../components/Modal';
import { Check, EmptyState, Field, Segmented, Stepper } from '../components/ui';
import { Icon } from '../components/icons';
import { useOverlay } from '../components/overlay';
import { db } from '../db/db';
import { progressId, resolveStatus, setInstanceProgress } from '../db/actions';
import { usePlanContext } from '../db/hooks';
import { fullName, isLocked, levelRange, planProgress, todayISO } from '../lib/logic';
import type { RunStatus } from '../lib/types';
import { ACCOUNT } from '../lib/types';

export function InstanceProgressForm({
  instanceId,
  characterId,
  onClose,
}: ModalProps & { instanceId: string; characterId?: string }) {
  const { toast, celebrate, open } = useOverlay();
  const ctx = usePlanContext();
  const inst = useLiveQuery(() => db.instances.get(instanceId), [instanceId]);
  const active = useMemo(() => ctx?.characters.filter((c) => c.status === 'active') ?? [], [ctx]);
  const [charId, setCharId] = useState(characterId ?? '');
  const char = active.find((c) => c.id === charId) ?? active[0];
  // Tagged with the character so a stale result is never loaded into the form.
  const loaded = useLiveQuery(
    async () => (char ? { charId: char.id, rec: await db.progress.get(progressId(char.id, instanceId)) } : undefined),
    [char?.id, instanceId],
  );
  const plans = useLiveQuery(
    async () =>
      (await db.plans.where('status').equals('active').toArray()).filter(
        (p) => p.target.instanceId === instanceId && (p.ownerId === char?.id || (p.ownerId === ACCOUNT && char?.isMain)),
      ),
    [instanceId, char?.id],
  );

  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [status, setStatus] = useState<RunStatus>('not-run');
  const [wings, setWings] = useState<string[]>([]);
  const [bosses, setBosses] = useState<string[]>([]);
  const [timesRun, setTimesRun] = useState(0);
  const [firstClear, setFirstClear] = useState('');

  useEffect(() => {
    if (!char || !loaded || loaded.charId !== char.id || loadedFor === char.id) return;
    const rec = loaded.rec;
    setStatus(rec?.status ?? 'not-run');
    setWings(rec?.wingsCleared ?? []);
    setBosses(rec?.bossesKilled ?? []);
    setTimesRun(rec?.timesRun ?? 0);
    setFirstClear(rec?.firstClearDate ?? '');
    setLoadedFor(char.id);
  }, [char, loaded, loadedFor]);

  if (!inst || !ctx) return null;

  if (!char) {
    return (
      <Modal title={inst.name} eyebrow="Instances" onClose={onClose} size="narrow">
        <div className="mb">
          <EmptyState
            title="Add a character first"
            action={
              <button type="button" className="btn" onClick={() => open({ kind: 'character' })}>
                Add your first character
              </button>
            }
          >
            Progress is tracked per character.
          </EmptyState>
        </div>
      </Modal>
    );
  }

  const locked = isLocked(inst, todayISO());
  const parts = inst.wings.length ? inst.wings : [];

  const pickStatus = (s: RunStatus) => {
    setStatus(s);
    if (s === 'cleared') {
      setWings(inst.wings.slice());
      setBosses(inst.bosses.slice());
      setTimesRun((t) => Math.max(1, t));
      if (!firstClear) setFirstClear(todayISO());
    } else if (s === 'run') {
      setTimesRun((t) => Math.max(1, t));
    } else {
      setWings([]);
      setBosses([]);
      setTimesRun(0);
      setFirstClear('');
    }
  };

  const toggle = (list: string[], set: (l: string[]) => void, v: string, on: boolean) => {
    const next = on ? [...new Set([...list, v])] : list.filter((x) => x !== v);
    set(next);
    const w = list === wings ? next : wings;
    const b = list === bosses ? next : bosses;
    const s = resolveStatus(inst, w, b, on ? status : status === 'cleared' ? 'run' : status);
    setStatus(s);
    if (s !== 'not-run') setTimesRun((t) => Math.max(1, t));
    if (s === 'cleared' && !firstClear) setFirstClear(todayISO());
  };

  // Preview what this save does to linked war plans.
  const draftRec = {
    id: progressId(char.id, inst.id),
    characterId: char.id,
    instanceId: inst.id,
    status,
    wingsCleared: wings,
    bossesKilled: bosses,
    questsDone: ctx.progress.find((p) => p.id === progressId(char.id, inst.id))?.questsDone ?? [],
    timesRun,
    firstClearDate: firstClear || undefined,
    source: 'manual' as const,
    updatedAt: '',
  };
  const previewCtx = { ...ctx, progress: [...ctx.progress.filter((p) => p.id !== draftRec.id), draftRec] };
  const planPreviews = (plans ?? []).map((p) => ({ plan: p, prog: planProgress(p, previewCtx) }));

  const save = async () => {
    const done = await setInstanceProgress(char.id, inst.id, {
      status,
      wingsCleared: wings,
      bossesKilled: bosses,
      timesRun,
      firstClearDate: firstClear || undefined,
    });
    toast(`${inst.name} updated for ${char.firstName}`);
    celebrate(done);
    onClose();
  };

  return (
    <Modal
      title={inst.name}
      onClose={onClose}
      onSubmit={save}
      size="narrow"
      header={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span className="eyebrow">Instances · for {char.firstName}</span>
          <span className="help tab">
            {inst.kind === 'raid' ? 'Raid' : 'Dungeon'} · {inst.size} player · {levelRange(inst)} · {inst.zone}
          </span>
        </div>
      }
      footer={
        <>
          <span />
          <div className="row-gap">
            <button type="button" className="btn2" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn">
              Save
            </button>
          </div>
        </>
      }
    >
      <div className="mb">
        {active.length > 1 && (
          <Field label="Character" htmlFor="ip-char">
            <select
              id="ip-char"
              className="inp"
              value={char.id}
              onChange={(e) => {
                setCharId(e.target.value);
                setLoadedFor(null);
              }}
            >
              {active.map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c)} · Lv {c.level}
                </option>
              ))}
            </select>
          </Field>
        )}
        {locked && (
          <div className="soft" style={{ padding: '12px 14px', fontSize: 14 }}>
            Opens {inst.unlockDate}. You can still log it ahead of time if the date moved.
          </div>
        )}
        <div className="field">
          <span className="lab">Status</span>
          <Segmented
            label="Status"
            value={status}
            onChange={pickStatus}
            options={[
              { value: 'not-run', label: 'Not run' },
              { value: 'run', label: 'Run' },
              { value: 'cleared', label: 'Cleared' },
            ]}
          />
        </div>
        {parts.length > 0 && (
          <div className="field" style={{ gap: 8 }}>
            <span className="lab">Wings cleared</span>
            <div className="two" style={{ gap: 6 }}>
              {parts.map((w) => (
                <Check key={w} checked={wings.includes(w)} green onChange={(on) => toggle(wings, setWings, w, on)}>
                  {w}
                </Check>
              ))}
            </div>
          </div>
        )}
        {inst.bosses.length > 0 && (
          <div className="field" style={{ gap: 8 }}>
            <span className="lab">Bosses killed</span>
            <div className="two" style={{ gap: 6 }}>
              {inst.bosses.map((b) => (
                <Check key={b} checked={bosses.includes(b)} green onChange={(on) => toggle(bosses, setBosses, b, on)}>
                  {b}
                </Check>
              ))}
            </div>
          </div>
        )}
        <div className="two">
          <Field label="Times run" htmlFor="ip-runs">
            <Stepper id="ip-runs" label="times run" value={timesRun} onChange={setTimesRun} min={0} max={999} />
          </Field>
          <Field label="First clear" htmlFor="ip-first" help={firstClear ? undefined : 'Set when you clear it all'}>
            <input id="ip-first" type="date" className="inp" value={firstClear} max={todayISO()} onChange={(e) => setFirstClear(e.target.value)} />
          </Field>
        </div>
        {planPreviews.map(({ plan, prog }) => (
          <div key={plan.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 4, background: 'rgba(0,0,0,.35)', border: '1px solid var(--sunk-edge)', fontSize: 14 }}>
            <Icon.flag size={18} color="#ffd100" />
            <span>
              {prog.done ? 'Completes' : 'Also updates'} your war plan <strong>{plan.title}</strong>
              {prog.done ? '.' : ` to ${prog.label}.`}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

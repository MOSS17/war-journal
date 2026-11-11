import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import { Modal, type ModalProps } from '../components/Modal';
import { Check, DiffDot, Field, Stepper, SwitchRow } from '../components/ui';
import { PlanIcon } from '../components/icons';
import { useOverlay } from '../components/overlay';
import { db } from '../db/db';
import { createPlan, deletePlan, updatePlan } from '../db/actions';
import { usePlanContext } from '../db/hooks';
import {
  DIFFICULTY_COLOR,
  DIFFICULTY_LABEL,
  fromCoins,
  instanceObjectiveLinks,
  levelRange,
  planProgress,
  toCoins,
  uid,
} from '../lib/logic';
import { MAX_LEVEL, MAX_SKILL, PRIMARY_PROFESSIONS, QUALITIES, QUALITY_COLOR, SECONDARY_PROFESSIONS } from '../lib/gamedata';
import type { Objective, PlanType, Quality, WarPlan } from '../lib/types';
import { ACCOUNT } from '../lib/types';

const TYPES: { type: PlanType; label: string }[] = [
  { type: 'dungeon', label: 'Dungeon' },
  { type: 'raid', label: 'Raid' },
  { type: 'level', label: 'Level' },
  { type: 'profession', label: 'Profession' },
  { type: 'gold', label: 'Gold' },
  { type: 'item', label: 'Item' },
  { type: 'custom', label: 'Custom' },
];

const NEEDS_CHARACTER: PlanType[] = ['level', 'profession'];

function nextMilestone(skill: number) {
  return [75, 150, 225, 300].find((m) => m > skill) ?? MAX_SKILL;
}

export function PlanForm({
  id,
  preset,
  onClose,
}: ModalProps & { id?: string; preset?: { type?: PlanType; instanceId?: string; ownerId?: string } }) {
  const { toast, open, celebrate } = useOverlay();
  const navigate = useNavigate();
  const ctx = usePlanContext();
  const existing = useLiveQuery(() => (id ? db.plans.get(id) : undefined), [id]);
  const activeCount = useLiveQuery(async () => {
    const all = await db.plans.where('status').equals('active').toArray();
    return { total: all.length, tracked: all.filter((p) => p.tracked).length };
  }, []);

  const [ready, setReady] = useState(false);
  const [type, setType] = useState<PlanType>(preset?.type ?? 'dungeon');
  const [ownerId, setOwnerId] = useState<string>(preset?.ownerId ?? '');
  const [instanceId, setInstanceId] = useState(preset?.instanceId ?? '');
  const [boss, setBoss] = useState('');
  const [targetLevel, setTargetLevel] = useState(0);
  const [profession, setProfession] = useState('');
  const [skill, setSkill] = useState(150);
  const [gold, setGold] = useState(100);
  const [item, setItem] = useState('');
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [freeObjs, setFreeObjs] = useState<Objective[]>([]);
  const [newObj, setNewObj] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [reward, setReward] = useState('');
  const [rewardQuality, setRewardQuality] = useState<Quality>('epic');
  const [notes, setNotes] = useState('');
  const [recLevel, setRecLevel] = useState('');
  const [tracked, setTracked] = useState(true);
  const [tried, setTried] = useState(false);

  const active = useMemo(() => ctx?.characters.filter((c) => c.status === 'active') ?? [], [ctx]);
  const main = active.find((c) => c.isMain) ?? active[0];
  const owner = ownerId === ACCOUNT ? undefined : active.find((c) => c.id === ownerId) ?? ctx?.characters.find((c) => c.id === ownerId);
  const instances = ctx?.instances ?? [];
  const inst = instances.find((i) => i.id === instanceId);

  // Initialise once data is in.
  useEffect(() => {
    if (ready || !ctx) return;
    if (id) {
      if (!existing) return;
      setType(existing.type);
      setOwnerId(existing.ownerId);
      setInstanceId(existing.target.instanceId ?? '');
      setBoss(existing.target.boss ?? '');
      setTargetLevel(existing.target.level ?? 0);
      setProfession(existing.target.profession ?? '');
      setSkill(existing.target.skill ?? 150);
      setGold(toCoins(existing.target.copper ?? 0).g);
      setItem(existing.target.item ?? '');
      setTitle(existing.title);
      setTitleTouched(true);
      setFreeObjs(existing.objectives.filter((o) => !o.link));
      setDueDate(existing.dueDate ?? '');
      setReward(existing.reward ?? '');
      setRewardQuality(existing.rewardQuality ?? 'epic');
      setNotes(existing.notes);
      setRecLevel(existing.level ? String(existing.level) : '');
      setTracked(existing.tracked);
    } else {
      const o = preset?.ownerId ?? main?.id ?? ACCOUNT;
      setOwnerId(o);
      const lvl = main?.level ?? 1;
      setTargetLevel(Math.min(MAX_LEVEL, Math.ceil((lvl + 1) / 5) * 5));
      if (preset?.instanceId) {
        const i = ctx.instances.find((x) => x.id === preset.instanceId);
        if (i) setType(i.kind === 'raid' ? 'raid' : 'dungeon');
      }
    }
    setReady(true);
  }, [ready, ctx, id, existing, preset, main]);

  // Owner can't be the warband for character-only plan types.
  useEffect(() => {
    if (ready && NEEDS_CHARACTER.includes(type) && ownerId === ACCOUNT && main) setOwnerId(main.id);
  }, [type, ownerId, main, ready]);

  const ownerProfs = ctx?.professions.filter((p) => p.characterId === ownerId) ?? [];
  useEffect(() => {
    if (!ready || type !== 'profession' || profession) return;
    const first = ownerProfs.find((p) => p.kind === 'primary') ?? ownerProfs[0];
    if (first) {
      setProfession(first.name);
      setSkill(nextMilestone(first.skill));
    }
  }, [ready, type, profession, ownerProfs]);

  const kindList = instances.filter((i) => i.kind === (type === 'raid' ? 'raid' : 'dungeon'));
  useEffect(() => {
    if (!ready || (type !== 'dungeon' && type !== 'raid')) return;
    if (!inst || inst.kind !== (type === 'raid' ? 'raid' : 'dungeon')) {
      const lvl = owner?.level ?? main?.level ?? 1;
      const pick =
        kindList.find((i) => lvl >= i.levelMin - 2 && lvl <= i.levelMax) ?? kindList[0];
      setInstanceId(pick?.id ?? '');
      setBoss('');
    }
  }, [ready, type, inst, kindList, owner, main]);

  const autoTitle = (() => {
    switch (type) {
      case 'dungeon':
        return inst?.name ?? '';
      case 'raid':
        return boss ? `Kill ${boss}` : inst ? `Clear ${inst.name}` : '';
      case 'level':
        return `Reach level ${targetLevel}`;
      case 'profession':
        return profession ? `${profession} ${skill}` : '';
      case 'gold':
        return `Gold: ${gold}g`;
      case 'item':
        return item ? `Get ${item}` : '';
      case 'custom':
        return '';
    }
  })();
  const shownTitle = titleTouched ? title : autoTitle;

  const linked = useMemo(
    () => (inst && (type === 'dungeon' || type === 'raid') ? instanceObjectiveLinks(inst, type === 'raid' ? boss || undefined : undefined) : []),
    [inst, type, boss],
  );

  const draft: WarPlan = {
    id: id ?? 'draft',
    title: shownTitle,
    type,
    ownerId: ownerId || ACCOUNT,
    status: 'active',
    tracked,
    target: buildTarget(),
    objectives: [
      ...linked.map((l, i) => {
        const prev = existing?.objectives.find((o) => o.link && JSON.stringify(o.link) === JSON.stringify(l.link));
        return { id: prev?.id ?? `l${i}`, text: l.text, link: l.link, done: false };
      }),
      ...freeObjs,
    ],
    dueDate: dueDate || undefined,
    level: recLevel ? Number(recLevel) : undefined,
    notes,
    reward: reward || undefined,
    rewardQuality: reward ? rewardQuality : undefined,
    createdAt: '',
    updatedAt: '',
  };

  function buildTarget(): WarPlan['target'] {
    switch (type) {
      case 'dungeon':
        return { instanceId };
      case 'raid':
        return { instanceId, boss: boss || undefined };
      case 'level':
        return { level: targetLevel };
      case 'profession':
        return { profession, skill };
      case 'gold':
        return { copper: fromCoins({ g: gold, s: 0, c: 0 }) };
      case 'item':
        return { item };
      case 'custom':
        return {};
    }
  }

  const prog = ctx && ready ? planProgress(draft, ctx) : null;

  const errors: string[] = [];
  if (!shownTitle.trim()) errors.push('Give the plan a name.');
  if ((type === 'dungeon' || type === 'raid') && !inst) errors.push('Pick an instance.');
  if (type === 'profession' && !profession) errors.push('Pick a profession.');
  if (type === 'gold' && gold <= 0) errors.push('Set a gold target.');
  if (type === 'item' && !item.trim()) errors.push('Name the item.');
  if (NEEDS_CHARACTER.includes(type) && ownerId === ACCOUNT) errors.push('Pick a character for this plan.');

  const save = async () => {
    setTried(true);
    if (errors.length) return;
    const objectives: Objective[] = draft.objectives.map((o) => (o.link ? { ...o, id: o.id.startsWith('l') && o.id.length < 4 ? uid() : o.id } : o));
    const input = {
      title: shownTitle.trim(),
      type,
      ownerId: draft.ownerId,
      tracked,
      target: draft.target,
      objectives,
      dueDate: draft.dueDate,
      level: draft.level,
      notes: notes.trim(),
      reward: draft.reward,
      rewardQuality: draft.rewardQuality,
    };
    if (id) {
      const done = await updatePlan(id, input);
      toast('Plan saved');
      celebrate(done);
      onClose();
    } else {
      const { id: newId, completed } = await createPlan(input);
      toast(`New war plan: ${input.title}`);
      celebrate(completed);
      onClose();
      navigate(`/plans?p=${newId}`);
    }
  };

  const ownerLabel = owner ? owner.firstName : 'the warband';
  const professionChoices = ownerProfs.length
    ? ownerProfs.map((p) => p.name)
    : [...PRIMARY_PROFESSIONS, ...SECONDARY_PROFESSIONS];
  if (profession && !professionChoices.includes(profession)) professionChoices.unshift(profession);

  return (
    <Modal
      title={id ? 'Edit war plan' : 'New war plan'}
      eyebrow="War Plans"
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <div>
            {id && existing && (
              <button
                type="button"
                className="btn2 danger"
                onClick={() =>
                  open({
                    kind: 'confirm',
                    title: `Delete “${existing.title}”?`,
                    body: 'The plan and its objectives are removed for good. Abandoning keeps it in Done instead.',
                    confirmLabel: 'Delete plan',
                    back: { kind: 'plan', id: existing.id },
                    onConfirm: async () => {
                      await deletePlan(existing.id);
                      toast('Plan deleted');
                      navigate('/plans');
                    },
                  })
                }
              >
                Delete plan
              </button>
            )}
          </div>
          <div className="row-gap">
            <button type="button" className="btn2" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn">
              {id ? 'Save plan' : 'Create plan'}
            </button>
          </div>
        </>
      }
    >
      <div className="mb">
        <div className="field" style={{ gap: 8 }}>
          <span className="lab" id="pf-type">
            What kind of plan?
          </span>
          <div role="radiogroup" aria-labelledby="pf-type" className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(76px, 1fr))' }}>
            {TYPES.map((t) => (
              <button key={t.type} type="button" role="radio" aria-checked={type === t.type} className="tile" onClick={() => setType(t.type)}>
                <span className="ic" aria-hidden="true">
                  <PlanIcon type={t.type} size={22} />
                </span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="two">
          {(type === 'dungeon' || type === 'raid') && (
            <Field label={type === 'raid' ? 'Raid' : 'Dungeon'} htmlFor="pf-inst">
              <select id="pf-inst" className="inp" value={instanceId} onChange={(e) => { setInstanceId(e.target.value); setBoss(''); }}>
                {kindList.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} · {levelRange(i)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {type === 'level' && (
            <Field label="Target level" htmlFor="pf-level">
              <Stepper id="pf-level" label="target level" value={targetLevel} onChange={setTargetLevel} min={2} max={MAX_LEVEL} />
            </Field>
          )}
          {type === 'profession' && (
            <Field label="Profession" htmlFor="pf-prof" help={ownerProfs.length ? undefined : `${ownerLabel} has no professions logged yet`}>
              <select id="pf-prof" className="inp" value={profession} onChange={(e) => {
                setProfession(e.target.value);
                const cur = ownerProfs.find((p) => p.name === e.target.value);
                setSkill(nextMilestone(cur?.skill ?? 0));
              }}>
                <option value="">Choose…</option>
                {professionChoices.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
          )}
          {type === 'gold' && (
            <Field label="Target" htmlFor="pf-gold" help={ownerId === ACCOUNT ? 'Counts gold across all active characters' : undefined}>
              <Stepper id="pf-gold" label="gold target" value={gold} onChange={setGold} min={1} max={99999} />
            </Field>
          )}
          {type === 'item' && (
            <Field label="Item" htmlFor="pf-item">
              <input id="pf-item" className="inp" value={item} placeholder="e.g. Brutal Hauberk" onChange={(e) => setItem(e.target.value)} />
            </Field>
          )}
          {type === 'custom' && (
            <Field label="Plan name" htmlFor="pf-title">
              <input id="pf-title" className="inp" value={shownTitle} placeholder="e.g. Explore all of Kalimdor" onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }} />
            </Field>
          )}
          <Field label="For" htmlFor="pf-owner">
            <select id="pf-owner" className="inp" value={ownerId} onChange={(e) => { setOwnerId(e.target.value); setProfession(''); }}>
              {active.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} · Lv {c.level}
                </option>
              ))}
              {owner && owner.status === 'retired' && (
                <option value={owner.id}>
                  {owner.firstName} {owner.lastName} (retired)
                </option>
              )}
              {!NEEDS_CHARACTER.includes(type) && <option value={ACCOUNT}>Whole warband</option>}
            </select>
          </Field>
          {type === 'raid' && inst && (
            <Field label="Goal" htmlFor="pf-boss" help={inst.bosses.length ? undefined : 'Add bosses on the instance page to target one'}>
              <select id="pf-boss" className="inp" value={boss} onChange={(e) => setBoss(e.target.value)}>
                <option value="">Clear the raid</option>
                {inst.bosses.map((b) => (
                  <option key={b} value={b}>
                    Kill {b}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {type === 'profession' && (
            <Field label="Target skill" htmlFor="pf-skill">
              <Stepper id="pf-skill" label="target skill" value={skill} onChange={setSkill} min={1} max={MAX_SKILL} />
            </Field>
          )}
          {type === 'item' && (
            <Field label="Quality" htmlFor="pf-iq">
              <select id="pf-iq" className="inp" value={rewardQuality} onChange={(e) => setRewardQuality(e.target.value as Quality)} style={{ color: QUALITY_COLOR[rewardQuality] }}>
                {QUALITIES.map((q) => (
                  <option key={q} value={q}>
                    {q[0].toUpperCase() + q.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        {prog && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 4, background: 'rgba(0,0,0,.45)', borderLeft: '3px solid var(--crimson-rule)', textShadow: 'var(--shadow)' }}>
            <DiffDot d={prog.difficulty} />
            <span style={{ fontSize: 14 }}>
              <strong style={{ color: DIFFICULTY_COLOR[prog.difficulty] }}>{DIFFICULTY_LABEL[prog.difficulty]}</strong> for {ownerLabel}
              {owner ? ` at level ${owner.level}` : ''}. Difficulty updates as you level.
            </span>
          </div>
        )}

        {type !== 'custom' && (
          <Field label="Plan name" htmlFor="pf-title2" help={titleTouched ? undefined : 'Filled in for you. Rename it if you like.'}>
            <input id="pf-title2" className="inp" value={shownTitle} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }} />
          </Field>
        )}

        <div className="field" style={{ gap: 8 }}>
          <span className="lab">
            Objectives{' '}
            <span className="opt">
              · {linked.length ? `from the ${inst?.wings.length && !boss ? "dungeon's wings" : 'instance'}` : 'optional checklist'}
            </span>
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {prog?.objectives
              .filter((o) => o.link)
              .map((o) => (
                <Check key={o.id} checked={o.done} disabled green right={o.done ? 'already cleared' : undefined}>
                  {o.text}
                </Check>
              ))}
            {freeObjs.map((o) => (
              <div key={o.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div className="grow">
                  <Check checked={o.done} onChange={(v) => setFreeObjs(freeObjs.map((x) => (x.id === o.id ? { ...x, done: v } : x)))}>
                    {o.text}
                  </Check>
                </div>
                <button type="button" className="iconbtn" aria-label={`Remove ${o.text}`} onClick={() => setFreeObjs(freeObjs.filter((x) => x.id !== o.id))}>
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="row-gap" style={{ gap: 8 }}>
            <label htmlFor="pf-obj" className="sr-only">
              New objective
            </label>
            <input
              id="pf-obj"
              className="inp grow"
              style={{ height: 38 }}
              placeholder="Add an objective"
              value={newObj}
              onChange={(e) => setNewObj(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (newObj.trim()) {
                    setFreeObjs([...freeObjs, { id: uid(), text: newObj.trim(), done: false }]);
                    setNewObj('');
                  }
                }
              }}
            />
            <button
              type="button"
              className="btn2 sm"
              onClick={() => {
                if (!newObj.trim()) return;
                setFreeObjs([...freeObjs, { id: uid(), text: newObj.trim(), done: false }]);
                setNewObj('');
              }}
            >
              + Add objective
            </button>
          </div>
        </div>

        <div className="two">
          <Field label="Target date" htmlFor="pf-due" optional>
            <input id="pf-due" type="date" className="inp" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          {type !== 'item' ? (
            <Field label="Reward" htmlFor="pf-reward" optional>
              <div style={{ display: 'flex', gap: 8 }}>
                <input id="pf-reward" className="inp grow" value={reward} placeholder="e.g. the epic you're after" onChange={(e) => setReward(e.target.value)} />
                {reward && (
                  <select aria-label="Reward quality" className="inp" style={{ width: 130, color: QUALITY_COLOR[rewardQuality] }} value={rewardQuality} onChange={(e) => setRewardQuality(e.target.value as Quality)}>
                    {QUALITIES.map((q) => (
                      <option key={q} value={q}>
                        {q[0].toUpperCase() + q.slice(1)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </Field>
          ) : (
            <Field label="Recommended level" htmlFor="pf-rec" optional help="Sets the difficulty colour">
              <input id="pf-rec" className="inp" inputMode="numeric" value={recLevel} onChange={(e) => setRecLevel(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} />
            </Field>
          )}
        </div>

        {(type === 'gold' || type === 'profession' || type === 'custom') && (
          <Field label="Recommended level" htmlFor="pf-rec2" optional help="Sets the difficulty colour; leave empty for Even">
            <input id="pf-rec2" className="inp" style={{ maxWidth: 160 }} inputMode="numeric" value={recLevel} onChange={(e) => setRecLevel(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} />
          </Field>
        )}

        <Field label="Notes" htmlFor="pf-notes" optional>
          <textarea id="pf-notes" className="inp" rows={3} value={notes} placeholder="Why it matters, who to bring, what to watch for" onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <SwitchRow
          title="Track on War Board"
          help={activeCount ? `You're tracking ${activeCount.tracked} of ${activeCount.total} active plans` : undefined}
          checked={tracked}
          onChange={setTracked}
        />

        {tried && errors.length > 0 && (
          <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {errors.map((e) => (
              <span key={e} className="err">
                {e}
              </span>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

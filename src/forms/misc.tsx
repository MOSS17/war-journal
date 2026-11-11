import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Modal, type ModalProps } from '../components/Modal';
import { Field, Segmented, Stepper, SwitchRow, TagInput } from '../components/ui';
import { Icon } from '../components/icons';
import { useOverlay, type ModalSpec } from '../components/overlay';
import { useCharacters, useCounts, useEvent, useInstance } from '../db/hooks';
import { useAccount } from '../db/supabase';
import { addInstance, deleteEvent, deleteInstance, saveEvent, updateInstance } from '../db/actions';
import { downloadJson, exportAll, importAll, parseBackup, resetAll } from '../db/backup';
import { MAX_LEVEL } from '../lib/gamedata';
import { todayISO } from '../lib/logic';
import type { GuideLink, InstanceKind, InstanceSize, Territory } from '../lib/types';

// ---------- Confirm ----------

export function ConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  back,
  onClose,
}: ModalProps & { title: string; body: ReactNode; confirmLabel: string; onConfirm: () => void | Promise<void>; back?: ModalSpec }) {
  const { open } = useOverlay();
  const [busy, setBusy] = useState(false);
  const cancel = () => (back ? open(back) : onClose());
  return (
    <Modal
      title={title}
      onClose={cancel}
      size="narrow"
      onSubmit={async () => {
        setBusy(true);
        await onConfirm();
        onClose();
      }}
      footer={
        <>
          <span />
          <div className="row-gap">
            <button type="button" className="btn2" onClick={cancel} autoFocus>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={busy}>
              {confirmLabel}
            </button>
          </div>
        </>
      }
    >
      <div className="mb">
        <p className="muted">{body}</p>
      </div>
    </Modal>
  );
}

// ---------- Quick add ----------

const QUICK: { key: string; label: string; help: string; icon: ReactNode; spec: ModalSpec }[] = [
  { key: 'J', label: 'Journal entry', help: 'Write about tonight', icon: <Icon.journal />, spec: { kind: 'journal' } },
  { key: 'P', label: 'War plan', help: 'Something to work toward', icon: <Icon.flag />, spec: { kind: 'plan' } },
  { key: 'U', label: 'Update progress', help: 'Level, gold, professions', icon: <Icon.up />, spec: { kind: 'progress' } },
  { key: 'L', label: 'Save to Library', help: 'A link or a note', icon: <Icon.link />, spec: { kind: 'library' } },
];

export function QuickAdd({ onClose }: ModalProps) {
  const { open } = useOverlay();
  const chars = useCharacters();
  const main = useMemo(() => chars && (chars.find((c) => c.isMain && c.status === 'active') ?? null), [chars]);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  return (
    <Modal title="Quick add" onClose={onClose} size="menu">
      <div role="menu" aria-label="Quick add" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="disp" aria-hidden="true" style={{ padding: '4px 10px 8px', color: 'var(--gold)', fontSize: 15 }}>
          Quick add
        </span>
        {QUICK.map((q, i) => (
          <button key={q.key} ref={i === 0 ? first : undefined} type="button" role="menuitem" className="qa" onClick={() => open(q.spec)}>
            <span className="ico">{q.icon}</span>
            <span className="grow" style={{ display: 'flex', flexDirection: 'column' }}>
              {q.label}
              <span className="help" style={{ fontWeight: 500 }}>
                {q.help}
              </span>
            </span>
            <span className="kbd">{q.key}</span>
          </button>
        ))}
        <div style={{ height: 1, margin: '4px 10px', background: 'rgba(143,143,150,.3)' }} />
        <button type="button" role="menuitem" className="qa" onClick={() => open({ kind: 'character' })}>
          <span className="ico">
            <Icon.person color="#40c040" />
          </span>
          <span className="grow" style={{ display: 'flex', flexDirection: 'column', color: 'var(--done)' }}>
            New character
            <span className="help" style={{ fontWeight: 500 }}>
              {main ? 'Rolled an alt?' : 'Start here'}
            </span>
          </span>
        </button>
      </div>
      <div className="help" style={{ padding: '10px 20px 14px', borderTop: '1px solid rgba(143,143,150,.3)', display: 'flex', justifyContent: 'space-between' }}>
        <span>
          Press <span className="kbd">N</span> anywhere
        </span>
        {main && <span>for {main.firstName}</span>}
      </div>
    </Modal>
  );
}

// ---------- Instance editor ----------

const SIZES: InstanceSize[] = [5, 10, 20, 40];

export function InstanceForm({ id, onClose }: ModalProps & { id?: string }) {
  const { toast, open } = useOverlay();
  const navigate = useNavigate();
  const existing = useInstance(id);
  const [ready, setReady] = useState(!id);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<InstanceKind>('dungeon');
  const [size, setSize] = useState<InstanceSize>(5);
  const [lo, setLo] = useState(30);
  const [hi, setHi] = useState(35);
  const [zone, setZone] = useState('');
  const [continent, setContinent] = useState('');
  const [isNew, setIsNew] = useState(true);
  const [unlock, setUnlock] = useState('');
  const [wings, setWings] = useState<string[]>([]);
  const [bosses, setBosses] = useState<string[]>([]);
  const [links, setLinks] = useState<GuideLink[]>([]);
  const [territory, setTerritory] = useState<Territory>('contested');
  const [hordeAccess, setHordeAccess] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (ready || !existing) return;
    setName(existing.name);
    setKind(existing.kind);
    setSize(existing.size);
    setLo(existing.levelMin);
    setHi(existing.levelMax);
    setZone(existing.zone);
    setContinent(existing.continent ?? '');
    setIsNew(existing.isNewInForever);
    setUnlock(existing.unlockDate ?? '');
    setWings(existing.wings);
    setBosses(existing.bosses);
    setLinks(existing.guideLinks);
    setTerritory(existing.territory);
    setHordeAccess(existing.hordeAccess);
    setReady(true);
  }, [ready, existing]);

  const errs = {
    name: !name.trim() ? 'Name the instance.' : null,
    zone: !zone.trim() ? 'Add the zone.' : null,
    range: hi < lo ? 'The top of the range is below the bottom.' : null,
  };

  const save = async () => {
    setTried(true);
    if (errs.name || errs.zone || errs.range) return;
    const data = {
      name: name.trim(),
      kind,
      size,
      levelMin: lo,
      levelMax: hi,
      zone: zone.trim(),
      continent: continent.trim() || undefined,
      isNewInForever: isNew,
      unlockDate: unlock || undefined,
      wings,
      bosses,
      guideLinks: links.filter((l) => l.url.trim()),
      territory,
      hordeAccess: hordeAccess.trim(),
    };
    if (id) {
      await updateInstance(id, data);
      toast(`${data.name} saved`);
      onClose();
    } else {
      const newId = await addInstance({ ...data, notes: '', quests: [] });
      toast(`${data.name} added`);
      onClose();
      navigate(`/instances?i=${newId}`);
    }
  };

  return (
    <Modal
      title={id ? `Edit ${existing?.name ?? 'instance'}` : 'Add instance'}
      eyebrow="Instances"
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
                    title: `Delete ${existing.name}?`,
                    body: 'Removes the instance and every character’s progress in it. War plans that point at it will show it as missing.',
                    confirmLabel: 'Delete instance',
                    back: { kind: 'instance', id },
                    onConfirm: async () => {
                      await deleteInstance(id);
                      toast(`${existing.name} deleted`);
                      navigate('/instances');
                    },
                  })
                }
              >
                Delete instance
              </button>
            )}
          </div>
          <div className="row-gap">
            <button type="button" className="btn2" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn">
              {id ? 'Save' : 'Add instance'}
            </button>
          </div>
        </>
      }
    >
      <div className="mb">
        <Field label="Name" htmlFor="if-name" error={tried ? errs.name : null}>
          <input id="if-name" className="inp" value={name} autoFocus={!id} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="two">
          <div className="field">
            <span className="lab">Kind</span>
            <Segmented
              label="Kind"
              value={kind}
              onChange={(k) => {
                setKind(k);
                if (k === 'dungeon') setSize(5);
                else if (size === 5) setSize(20);
              }}
              options={[
                { value: 'dungeon', label: 'Dungeon' },
                { value: 'raid', label: 'Raid' },
              ]}
            />
          </div>
          <div className="field">
            <span className="lab">Size</span>
            <Segmented
              label="Size"
              value={String(size) as `${InstanceSize}`}
              onChange={(v) => setSize(Number(v) as InstanceSize)}
              options={SIZES.map((s) => ({ value: String(s) as `${InstanceSize}`, label: String(s) }))}
            />
          </div>
        </div>
        <div className="two">
          <Field label="Lowest level" htmlFor="if-lo">
            <Stepper id="if-lo" label="lowest level" value={lo} onChange={setLo} min={1} max={MAX_LEVEL} />
          </Field>
          <Field label="Highest level" htmlFor="if-hi" error={errs.range}>
            <Stepper id="if-hi" label="highest level" value={hi} onChange={setHi} min={1} max={MAX_LEVEL} invalid={!!errs.range} />
          </Field>
        </div>
        <div className="two">
          <Field label="Zone" htmlFor="if-zone" error={tried ? errs.zone : null}>
            <input id="if-zone" className="inp" value={zone} onChange={(e) => setZone(e.target.value)} />
          </Field>
          <Field label="Continent" htmlFor="if-cont" optional>
            <input id="if-cont" className="inp" list="if-continents" value={continent} onChange={(e) => setContinent(e.target.value)} />
            <datalist id="if-continents">
              <option value="Kalimdor" />
              <option value="Eastern Kingdoms" />
            </datalist>
          </Field>
        </div>
        <div className="two">
          <Field label="Unlock date" htmlFor="if-unlock" optional help="Shown as Locked until then">
            <input id="if-unlock" type="date" className="inp" value={unlock} onChange={(e) => setUnlock(e.target.value)} />
          </Field>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <SwitchRow title="New in Forever" checked={isNew} onChange={setIsNew} />
          </div>
        </div>
        <div className="field">
          <span className="lab">Territory</span>
          <Segmented
            label="Territory"
            value={territory}
            onChange={setTerritory}
            options={[
              { value: 'horde', label: 'Horde' },
              { value: 'contested', label: 'Contested' },
              { value: 'alliance', label: 'Alliance' },
            ]}
          />
        </div>
        <Field label="How Horde gets in" htmlFor="if-access" optional help="Flight point, route, keys">
          <textarea id="if-access" className="inp" rows={2} value={hordeAccess} onChange={(e) => setHordeAccess(e.target.value)} />
        </Field>
        <Field label="Wings" htmlFor="if-wings" optional help="Each wing becomes an objective on dungeon plans">
          <TagInput id="if-wings" tags={wings} onChange={setWings} />
        </Field>
        <Field label="Bosses" htmlFor="if-bosses" optional help="Add them as you meet them">
          <TagInput id="if-bosses" tags={bosses} onChange={setBosses} />
        </Field>
        <div className="field" style={{ gap: 8 }}>
          <span className="lab">
            Guide links <span className="opt">· optional</span>
          </span>
          {links.map((l, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr auto', gap: 8 }}>
              <input className="inp" aria-label="Link name" placeholder="Name" value={l.title} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <input className="inp" aria-label="Link URL" placeholder="https://" type="url" value={l.url} onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
              <button type="button" className="iconbtn" style={{ height: 46, width: 46 }} aria-label="Remove link" onClick={() => setLinks(links.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
          <button type="button" className="btn2 sm" style={{ alignSelf: 'flex-start' }} onClick={() => setLinks([...links, { title: '', url: '' }])}>
            + Add link
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- Event ----------

export function EventForm({ id, onClose }: ModalProps & { id?: string }) {
  const { toast, open } = useOverlay();
  const existing = useEvent(id);
  const [ready, setReady] = useState(!id);
  const [title, setTitle] = useState('');
  const [hasDate, setHasDate] = useState(true);
  const [date, setDate] = useState(todayISO());
  const [label, setLabel] = useState('');
  const [approx, setApprox] = useState(todayISO());
  const [detail, setDetail] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (ready || !existing) return;
    setTitle(existing.title);
    setHasDate(!!existing.date);
    setDate(existing.date ?? todayISO());
    setLabel(existing.dateLabel ?? '');
    setApprox(existing.approxDate);
    setDetail(existing.detail ?? '');
    setReady(true);
  }, [ready, existing]);

  const err = !title.trim() ? 'Name the date.' : !hasDate && !label.trim() ? 'Say roughly when, e.g. Spring 2027.' : null;

  const save = async () => {
    setTried(true);
    if (err) return;
    await saveEvent(id, {
      title: title.trim(),
      date: hasDate ? date : undefined,
      dateLabel: hasDate ? undefined : label.trim(),
      approxDate: hasDate ? date : approx,
      detail: detail.trim() || undefined,
    });
    toast(id ? 'Date saved' : 'Added to the horizon');
    onClose();
  };

  return (
    <Modal
      title={id ? 'Edit date' : 'Add a date'}
      eyebrow="On the horizon"
      onClose={onClose}
      onSubmit={save}
      size="narrow"
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
                    title: `Remove “${existing.title}”?`,
                    body: 'It comes off the War Board countdowns.',
                    confirmLabel: 'Remove',
                    back: { kind: 'event', id },
                    onConfirm: async () => {
                      await deleteEvent(id);
                      toast('Removed');
                    },
                  })
                }
              >
                Remove
              </button>
            )}
          </div>
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
        <Field label="What's happening" htmlFor="ef-title" error={tried ? err : null}>
          <input id="ef-title" className="inp" autoFocus value={title} placeholder="e.g. Guild raid night" onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Segmented
          label="Date known?"
          value={hasDate ? 'date' : 'season'}
          onChange={(v) => setHasDate(v === 'date')}
          options={[
            { value: 'date', label: 'Exact date' },
            { value: 'season', label: 'Roughly' },
          ]}
        />
        {hasDate ? (
          <Field label="Date" htmlFor="ef-date">
            <input id="ef-date" type="date" className="inp" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
          </Field>
        ) : (
          <div className="two">
            <Field label="When" htmlFor="ef-label" help="Shown instead of a date">
              <input id="ef-label" className="inp" value={label} placeholder="Spring 2027" onChange={(e) => setLabel(e.target.value)} />
            </Field>
            <Field label="Sort as" htmlFor="ef-approx" help="Orders it among other dates">
              <input id="ef-approx" type="date" className="inp" value={approx} onChange={(e) => setApprox(e.target.value || todayISO())} />
            </Field>
          </div>
        )}
        <Field label="Details" htmlFor="ef-detail" optional>
          <input id="ef-detail" className="inp" value={detail} onChange={(e) => setDetail(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

// ---------- Backup & data ----------

export function DataModal({ onClose }: ModalProps) {
  const { toast, open } = useOverlay();
  const counts = useCounts();
  const account = useAccount();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    setBusy(true);
    try {
      const data = await exportAll();
      downloadJson(data, `war-journal-${todayISO()}.json`);
      toast('Backup downloaded');
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file: File) => {
    setError(null);
    try {
      const backup = parseBackup(await file.text());
      const n = backup.tables.characters?.length ?? 0;
      open({
        kind: 'confirm',
        title: 'Replace everything with this backup?',
        body: `The backup from ${new Date(backup.exportedAt).toLocaleString()} has ${n} character${n === 1 ? '' : 's'}. Everything in your journal now is replaced. Export first if you want to keep it.`,
        confirmLabel: 'Replace my data',
        back: { kind: 'data' },
        onConfirm: async () => {
          await importAll(backup);
          toast('Backup restored');
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.');
    }
  };

  return (
    <Modal title="Backup & data" eyebrow="Your data" onClose={onClose} size="narrow">
      <div className="mb">
        <p className="muted">
          {account && !account.anonymous
            ? `Your journal is saved to your account (${account.email}); screenshots stay in this browser for now.`
            : 'Your journal is saved online, but only this browser can open it until you save your account. Screenshots stay in this browser for now.'}{' '}
          Export a backup file now and then to keep your own copy.
        </p>
        {counts && (
          <p className="help tab">
            {counts.characters} characters · {counts.plans} plans · {counts.journal} journal entries · {counts.images} screenshots ·{' '}
            {counts.library} library items
          </p>
        )}
        <div className="row-gap">
          <button type="button" className="btn" onClick={doExport} disabled={busy}>
            {busy ? 'Preparing…' : 'Export backup'}
          </button>
          <button type="button" className="btn2" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
              e.target.value = '';
            }}
          />
        </div>
        {error && (
          <span className="err" role="alert">
            <Icon.alert />
            {error}
          </span>
        )}
        <div style={{ borderTop: '1px solid var(--sunk-edge)', paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="lab">Start over</span>
          <span className="help">Deletes every character, plan, entry and link, then restores the instance list and dates.</span>
          <button
            type="button"
            className="btn2 danger"
            style={{ alignSelf: 'flex-start' }}
            onClick={() =>
              open({
                kind: 'confirm',
                title: 'Delete all your data?',
                body: 'Your whole journal is deleted. This can’t be undone unless you have a backup file.',
                confirmLabel: 'Delete everything',
                back: { kind: 'data' },
                onConfirm: async () => {
                  await resetAll();
                  toast('All data deleted');
                },
              })
            }
          >
            Delete all data
          </button>
        </div>
      </div>
    </Modal>
  );
}

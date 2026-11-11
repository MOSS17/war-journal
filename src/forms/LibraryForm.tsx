import { useEffect, useMemo, useState } from 'react';
import { Modal, type ModalProps } from '../components/Modal';
import { Field, Segmented, SwitchRow, TagInput } from '../components/ui';
import { useOverlay } from '../components/overlay';
import { useActivePlans, useInstances, useLibraryCategories, useLibraryItem } from '../db/hooks';
import { LIBRARY_CATEGORIES } from '../lib/gamedata';
import { deleteLibraryItem, saveLibraryItem } from '../db/actions';

function guessName(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '').replace(/[-_]/g, ' ');
    return last ? `${host}: ${last}` : host;
  } catch {
    return '';
  }
}

function normaliseUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return /^[a-z]+:\/\//i.test(t) ? t : `https://${t}`;
}

export function LibraryForm({
  id,
  preset,
  onClose,
}: ModalProps & { id?: string; preset?: { kind?: 'link' | 'note'; instanceId?: string; planId?: string } }) {
  const { toast, open } = useOverlay();
  const existing = useLibraryItem(id);
  const allInstances = useInstances();
  const instances = useMemo(() => allInstances && [...allInstances].sort((a, b) => a.name.localeCompare(b.name)), [allInstances]);
  const active = useActivePlans();
  const plans = useMemo(() => active && [...active].sort((a, b) => a.title.localeCompare(b.title)), [active]);
  const cats = useLibraryCategories();

  const [ready, setReady] = useState(!id);
  const [kind, setKind] = useState<'link' | 'note'>(preset?.kind ?? 'link');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [category, setCategory] = useState(preset?.instanceId ? 'Dungeons' : 'Wiki');
  const [newCat, setNewCat] = useState('');
  const [attach, setAttach] = useState(preset?.instanceId ? `i:${preset.instanceId}` : preset?.planId ? `p:${preset.planId}` : '');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [pinned, setPinned] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (ready || !existing) return;
    setKind(existing.kind);
    setUrl(existing.url ?? '');
    setTitle(existing.title);
    setTitleTouched(true);
    setCategory(existing.category);
    setAttach(existing.instanceId ? `i:${existing.instanceId}` : existing.planId ? `p:${existing.planId}` : '');
    setBody(existing.body);
    setTags(existing.tags);
    setPinned(existing.pinned);
    setReady(true);
  }, [ready, existing]);

  const shownTitle = titleTouched || kind === 'note' ? title : guessName(normaliseUrl(url));
  const cat = category === '__new' ? newCat.trim() : category;

  let urlErr: string | null = null;
  if (kind === 'link') {
    try {
      const u = new URL(normaliseUrl(url));
      if (!/^https?:$/.test(u.protocol)) urlErr = 'Links need to start with http or https.';
    } catch {
      urlErr = 'Paste a full link, e.g. https://warcraft.wiki.gg';
    }
  }
  const titleErr = !shownTitle.trim() ? 'Give it a name.' : null;
  const bodyErr = kind === 'note' && !body.trim() ? 'Write the note.' : null;
  const catErr = !cat ? 'Name the category.' : null;

  const save = async () => {
    setTried(true);
    if (urlErr || titleErr || bodyErr || catErr) return;
    await saveLibraryItem(id, {
      kind,
      title: shownTitle.trim(),
      url: kind === 'link' ? normaliseUrl(url) : undefined,
      body: body.trim(),
      category: cat,
      tags,
      pinned,
      instanceId: attach.startsWith('i:') ? attach.slice(2) : undefined,
      planId: attach.startsWith('p:') ? attach.slice(2) : undefined,
    });
    toast(id ? 'Saved' : kind === 'link' ? 'Link saved to the Library' : 'Note saved to the Library');
    onClose();
  };

  return (
    <Modal
      title={id ? (kind === 'note' ? 'Edit note' : 'Edit link') : 'Save to Library'}
      eyebrow="Library"
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
                    title: `Delete “${existing.title}”?`,
                    body: 'It’s removed from your Library.',
                    confirmLabel: 'Delete',
                    back: { kind: 'library', id },
                    onConfirm: async () => {
                      await deleteLibraryItem(id);
                      toast('Deleted from the Library');
                    },
                  })
                }
              >
                Delete
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
        {!id && (
          <Segmented
            label="Kind"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'link', label: 'Link' },
              { value: 'note', label: 'Note' },
            ]}
          />
        )}
        {kind === 'link' && (
          <Field label="Link" htmlFor="lf-url" error={tried ? urlErr : null}>
            <input
              id="lf-url"
              className="inp"
              type="url"
              autoFocus
              placeholder="https://"
              value={url}
              aria-invalid={tried && !!urlErr}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
        )}
        <Field label="Name" htmlFor="lf-name" help="How it shows in your Library" error={tried ? titleErr : null}>
          <input
            id="lf-name"
            className="inp"
            autoFocus={kind === 'note'}
            value={shownTitle}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleTouched(true);
            }}
          />
        </Field>
        <div className="two">
          <Field label="Category" htmlFor="lf-cat" error={tried ? catErr : null}>
            <select id="lf-cat" className="inp" value={category} onChange={(e) => setCategory(e.target.value)}>
              {(cats ?? LIBRARY_CATEGORIES).map((c) => (
                <option key={c}>{c}</option>
              ))}
              <option value="__new">New category…</option>
            </select>
            {category === '__new' && (
              <input className="inp" aria-label="New category name" placeholder="Category name" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            )}
          </Field>
          <Field label="Attach to" htmlFor="lf-attach" optional>
            <select id="lf-attach" className="inp" value={attach} onChange={(e) => setAttach(e.target.value)}>
              <option value="">Nothing</option>
              <optgroup label="Instances">
                {instances?.map((i) => (
                  <option key={i.id} value={`i:${i.id}`}>
                    {i.name}
                  </option>
                ))}
              </optgroup>
              {plans && plans.length > 0 && (
                <optgroup label="War plans">
                  {plans.map((p) => (
                    <option key={p.id} value={`p:${p.id}`}>
                      {p.title}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </Field>
        </div>
        {kind === 'link' ? (
          <Field label="Why I saved it" htmlFor="lf-why" optional>
            <input id="lf-why" className="inp" placeholder="e.g. systems and patch notes" value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        ) : (
          <Field label="Note" htmlFor="lf-body" error={tried ? bodyErr : null}>
            <textarea id="lf-body" className="inp" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        )}
        <Field label="Tags" htmlFor="lf-tags" optional>
          <TagInput id="lf-tags" tags={tags} onChange={setTags} />
        </Field>
        <SwitchRow title="Pin to the top" checked={pinned} onChange={setPinned} bare />
      </div>
    </Modal>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Modal, type ModalProps } from '../components/Modal';
import { DropZone, Field, TagInput } from '../components/ui';
import { useOverlay } from '../components/overlay';
import { addImages, cleanupOrphanImages, deleteEntry, saveEntry, type EntryInput } from '../db/actions';
import { useCharacters, useEntry, useImageUrl } from '../db/hooks';
import { JOURNAL_TAG_SUGGESTIONS } from '../lib/gamedata';
import { formatDate, fullName, todayISO } from '../lib/logic';

const MAX_BODY = 4000;

function Thumb({ id, onRemove }: { id: string; onRemove: () => void }) {
  const url = useImageUrl(id);
  return (
    <div className="thumb-img">
      {url && <img src={url} alt="Screenshot" />}
      <button type="button" aria-label="Remove screenshot" onClick={onRemove}>
        ×
      </button>
    </div>
  );
}

export function JournalForm({
  id,
  preset,
  onClose,
}: ModalProps & { id?: string; preset?: { characterId?: string; title?: string; tags?: string[]; body?: string } }) {
  const { toast, open } = useOverlay();
  const chars = useCharacters();
  const existing = useEntry(id);

  const [entryId, setEntryId] = useState<string | undefined>(id);
  const [isDraft, setIsDraft] = useState(true);
  const [ready, setReady] = useState(false);
  const [characterId, setCharacterId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [title, setTitle] = useState(preset?.title ?? '');
  const [body, setBody] = useState(preset?.body ?? '');
  const [tags, setTags] = useState<string[]>(preset?.tags ?? []);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [level, setLevel] = useState<number | undefined>();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [tried, setTried] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (ready || !chars) return;
    if (id) {
      if (!existing) return;
      setCharacterId(existing.characterId ?? '');
      setDate(existing.date);
      setTitle(existing.title);
      setBody(existing.body);
      setTags(existing.tags);
      setImageIds(existing.imageIds);
      setLevel(existing.level);
      setIsDraft(existing.draft);
    } else {
      const main = chars.find((c) => c.isMain && c.status === 'active') ?? chars[0];
      const c = chars.find((x) => x.id === preset?.characterId) ?? main;
      setCharacterId(c?.id ?? '');
      setLevel(c?.level);
    }
    setReady(true);
  }, [ready, chars, id, existing, preset]);

  const char = chars?.find((c) => c.id === characterId);
  const input = (draft: boolean): EntryInput => ({
    date,
    characterId: characterId || undefined,
    level: level ?? char?.level,
    title: title.trim(),
    body: body.trim(),
    imageIds,
    tags,
    draft,
  });
  const hasContent = !!(title.trim() || body.trim() || imageIds.length);

  // Autosave drafts while typing.
  useEffect(() => {
    if (!ready || !isDraft || !dirty.current || !hasContent) return;
    const t = setTimeout(async () => {
      const saved = await saveEntry(entryId, input(true));
      setEntryId(saved);
      setSavedAt(Date.now());
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isDraft, characterId, date, title, body, tags, imageIds, level]);

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    dirty.current = true;
    set(v);
  };

  const save = async () => {
    setTried(true);
    if (!title.trim() && !body.trim()) return;
    await saveEntry(entryId, input(false));
    await cleanupOrphanImages();
    toast(isDraft ? 'Entry saved to the journal' : 'Entry updated');
    onClose();
  };

  const cancel = async () => {
    if (isDraft && entryId && hasContent) {
      await saveEntry(entryId, input(true));
      toast('Draft kept. Finish it from the Journal.');
    }
    // Screenshots added and then abandoned (or removed from a saved entry) go away.
    await cleanupOrphanImages();
    onClose();
  };

  const discard = () =>
    open({
      kind: 'confirm',
      title: 'Discard this draft?',
      body: 'The draft and its screenshots are deleted.',
      confirmLabel: 'Discard draft',
      back: entryId ? { kind: 'journal', id: entryId } : undefined,
      onConfirm: async () => {
        if (entryId) await deleteEntry(entryId);
        await cleanupOrphanImages();
        toast('Draft discarded');
      },
    });

  const ago = savedAt ? 'Draft saved a moment ago' : isDraft && entryId ? 'Draft' : '';
  const titleErr = tried && !title.trim() && !body.trim() ? 'Write a title or a few lines.' : null;

  return (
    <Modal
      title={id && !isDraft ? 'Edit entry' : 'New entry'}
      eyebrow="Journal"
      onClose={cancel}
      onSubmit={save}
      footer={
        <>
          <div className="row-gap">
            {isDraft && (entryId || hasContent) ? (
              <button type="button" className="btn2 quiet" onClick={discard}>
                Discard draft
              </button>
            ) : (
              !isDraft &&
              entryId && (
                <button
                  type="button"
                  className="btn2 danger"
                  onClick={() =>
                    open({
                      kind: 'confirm',
                      title: `Delete “${title || 'this entry'}”?`,
                      body: 'The entry and its screenshots are deleted for good.',
                      confirmLabel: 'Delete entry',
                      back: { kind: 'journal', id: entryId },
                      onConfirm: async () => {
                        await deleteEntry(entryId);
                        toast('Entry deleted');
                      },
                    })
                  }
                >
                  Delete entry
                </button>
              )
            )}
            <span className="help" aria-live="polite">
              {ago}
            </span>
          </div>
          <div className="row-gap">
            <button type="button" className="btn2" onClick={cancel}>
              Cancel
            </button>
            <button type="submit" className="btn">
              Save entry
            </button>
          </div>
        </>
      }
    >
      <div className="mb">
        <div className="two">
          <Field label="Character" htmlFor="jf-char">
            <select
              id="jf-char"
              className="inp"
              value={characterId}
              onChange={(e) => {
                dirty.current = true;
                setCharacterId(e.target.value);
                if (!id) setLevel(chars?.find((c) => c.id === e.target.value)?.level);
              }}
            >
              <option value="">No character</option>
              {chars?.map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c)} · Lv {c.level}
                  {c.status === 'retired' ? ' (retired)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date" htmlFor="jf-date" help={date === todayISO() ? `Tonight · ${formatDate(date, 'weekday')}` : formatDate(date, 'weekday')}>
            <input id="jf-date" type="date" className="inp" value={date} max={todayISO()} onChange={(e) => touch(setDate)(e.target.value || todayISO())} />
          </Field>
        </div>
        <Field label="Title" htmlFor="jf-title" error={titleErr}>
          <input
            id="jf-title"
            className="inp"
            value={title}
            autoFocus
            placeholder="e.g. Ganked at the Crossroads"
            style={{ fontFamily: 'var(--f-title)', fontSize: 18 }}
            onChange={(e) => touch(setTitle)(e.target.value)}
          />
        </Field>
        <div className="field">
          <label className="lab" htmlFor="jf-body">
            What happened?
          </label>
          <textarea
            id="jf-body"
            className="inp journal-text"
            rows={6}
            maxLength={MAX_BODY}
            value={body}
            onChange={(e) => touch(setBody)(e.target.value)}
          />
          <span className="help" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <span className="tab">
              {body.length.toLocaleString()} / {MAX_BODY.toLocaleString()}
            </span>
          </span>
        </div>
        <div className="field" style={{ gap: 8 }}>
          <span className="lab">Screenshots</span>
          <div className="thumbs">
            {imageIds.map((iid) => (
              <Thumb
                key={iid}
                id={iid}
                onRemove={() => {
                  dirty.current = true;
                  setImageIds(imageIds.filter((x) => x !== iid));
                }}
              />
            ))}
            <DropZone
              onFiles={async (files) => {
                const ids = await addImages(files);
                if (ids.length) {
                  dirty.current = true;
                  setImageIds((cur) => [...cur, ...ids]);
                }
              }}
            />
          </div>
          <span className="help">Your own screenshots. They stay in this browser and go into your backup file.</span>
        </div>
        <Field label="Tags" htmlFor="jf-tags">
          <TagInput id="jf-tags" tags={tags} onChange={touch(setTags)} suggestions={JOURNAL_TAG_SUGGESTIONS} />
        </Field>
      </div>
    </Modal>
  );
}

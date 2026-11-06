import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Page } from '../components/Shell';
import { EmptyState, SectionHead } from '../components/ui';
import { Icon } from '../components/icons';
import { useOverlay } from '../components/overlay';
import { db } from '../db/db';
import { useLibrary } from '../db/hooks';
import { togglePin } from '../db/actions';
import type { LibraryItem } from '../lib/types';

const MONO_BG = ['#8e2a22', '#5a3a1c', '#2a4a6a', '#3a2a4a', '#2f4a2a', '#5a2a3a'];

function host(url?: string) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function mono(title: string) {
  const words = title.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 1)).toUpperCase();
}

function monoBg(title: string) {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MONO_BG[h % MONO_BG.length];
}

export function Library() {
  const { open } = useOverlay();
  const [params, setParams] = useSearchParams();
  const items = useLibrary();
  const instances = useLiveQuery(async () => new Map((await db.instances.toArray()).map((i) => [i.id, i.name])), []);
  const plans = useLiveQuery(async () => new Map((await db.plans.toArray()).map((p) => [p.id, p.title])), []);
  const searchRef = useRef<HTMLInputElement>(null);

  const q = params.get('q') ?? '';
  const cat = params.get('cat');
  useEffect(() => {
    if (params.get('focus')) {
      searchRef.current?.focus();
      const n = new URLSearchParams(params);
      n.delete('focus');
      setParams(n, { replace: true });
    }
  }, [params, setParams]);

  if (!items) return null;
  const setP = (k: string, v: string | null) => {
    const n = new URLSearchParams(params);
    if (!v) n.delete(k);
    else n.set(k, v);
    setParams(n, { replace: true });
  };

  const needle = q.trim().toLowerCase();
  const attachName = (it: LibraryItem) =>
    (it.instanceId && instances?.get(it.instanceId)) || (it.planId && plans?.get(it.planId)) || '';
  const searched = needle
    ? items.filter((it) =>
        [it.title, it.body, it.url ?? '', it.category, ...it.tags, attachName(it)].some((s) => s.toLowerCase().includes(needle)),
      )
    : items;
  const cats = [...new Set(items.map((i) => i.category))].sort();
  const shown = cat ? searched.filter((i) => i.category === cat) : searched;
  const pinned = shown.filter((i) => i.pinned);
  const rest = shown.filter((i) => !i.pinned);

  return (
    <Page
      variant="library"
      title="Library"
      eyebrow="Anything you look up twice lives here"
      actions={
        <>
          <button type="button" className="btn2" onClick={() => open({ kind: 'library', preset: { kind: 'note' } })}>
            + Note
          </button>
          <button type="button" className="btn" onClick={() => open({ kind: 'library', preset: { kind: 'link' } })}>
            + Save a link
          </button>
        </>
      }
    >
      <div className="stack">
        <label htmlFor="lib-q" className="searchbox">
          <Icon.search color="#c9a45c" />
          <span className="sr-only">Search the Library</span>
          <input
            ref={searchRef}
            id="lib-q"
            data-search
            type="search"
            className="inline-input"
            placeholder="Search links and notes, e.g. Scarlet Monastery keys"
            value={q}
            onChange={(e) => setP('q', e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && (e.currentTarget.blur(), setP('q', null))}
          />
          <span className="kbd" aria-hidden="true">
            /
          </span>
        </label>

        {cats.length > 0 && (
          <div role="group" aria-label="Category" className="row-gap" style={{ gap: 8 }}>
            <button type="button" className="cat" aria-pressed={!cat} onClick={() => setP('cat', null)}>
              All · {searched.length}
            </button>
            {cats.map((c) => (
              <button key={c} type="button" className="cat" aria-pressed={cat === c} onClick={() => setP('cat', cat === c ? null : c)}>
                {c}
              </button>
            ))}
          </div>
        )}

        {items.length === 0 ? (
          <section className="card">
            <EmptyState
              title="Stop re-googling"
              action={
                <div className="row-gap">
                  <button type="button" className="btn" onClick={() => open({ kind: 'library', preset: { kind: 'link' } })}>
                    + Save your first link
                  </button>
                  <button type="button" className="btn2" onClick={() => open({ kind: 'library', preset: { kind: 'note' } })}>
                    + Write a note
                  </button>
                </div>
              }
            >
              Save the guides, maps and addon lists you keep going back to, plus short notes like trainer locations or safe flight
              paths. Pin the ones you use most.
            </EmptyState>
          </section>
        ) : shown.length === 0 ? (
          <section className="card">
            <EmptyState title="Nothing found">No links or notes match “{q}”.</EmptyState>
          </section>
        ) : (
          <>
            {pinned.length > 0 && (
              <section aria-labelledby="lib-pinned" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <SectionHead id="lib-pinned" title="Pinned" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(270px, 100%), 1fr))', gap: 16 }}>
                  {pinned.map((l) => (
                    <Tile key={l.id} item={l} attached={attachName(l)} />
                  ))}
                </div>
              </section>
            )}
            {rest.length > 0 && (
              <section className="card" aria-label="All items" style={{ padding: 8 }}>
                {rest.map((it) => (
                  <Row key={it.id} item={it} attached={attachName(it)} />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </Page>
  );
}

function ItemActions({ item }: { item: LibraryItem }) {
  const { open } = useOverlay();
  return (
    <span style={{ display: 'flex', gap: 4 }}>
      <button
        type="button"
        className="iconbtn"
        aria-label={item.pinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
        aria-pressed={item.pinned}
        onClick={(e) => {
          e.preventDefault();
          togglePin(item);
        }}
        style={item.pinned ? { color: '#e0763a' } : undefined}
      >
        <Icon.pin size={16} />
      </button>
      <button
        type="button"
        className="iconbtn"
        aria-label={`Edit ${item.title}`}
        onClick={(e) => {
          e.preventDefault();
          open({ kind: 'library', id: item.id });
        }}
      >
        <Icon.edit size={16} />
      </button>
    </span>
  );
}

function Tile({ item, attached }: { item: LibraryItem; attached: string }) {
  const { open } = useOverlay();
  const inner = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingRight: 80 }}>
        <span className="mono disp" style={{ background: item.kind === 'note' ? '#4a3a16' : monoBg(item.title), fontSize: mono(item.title).length > 1 ? 15 : 18 }} aria-hidden="true">
          {item.kind === 'note' ? <Icon.note size={20} color="#e4c66a" /> : mono(item.title)}
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{item.title}</span>
          <span className="help ellipsis">{item.kind === 'link' ? host(item.url) : 'Note'}</span>
        </span>
      </div>
      {item.body && (
        <span style={{ fontSize: 14, color: 'var(--ash)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {item.body}
        </span>
      )}
      <span className="row-gap" style={{ gap: 6 }}>
        <span className="pill">{item.category}</span>
        {attached && <span className="pill main">{attached}</span>}
      </span>
    </>
  );
  return (
    <div className="card" style={{ position: 'relative' }}>
      {item.kind === 'link' && item.url ? (
        <a href={item.url} target="_blank" rel="noreferrer" className="ltile">
          {inner}
        </a>
      ) : (
        <button type="button" className="ltile" onClick={() => open({ kind: 'library', id: item.id })} style={{ border: 0, background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
          {inner}
        </button>
      )}
      <span style={{ position: 'absolute', top: 14, right: 14 }}>
        <ItemActions item={item} />
      </span>
    </div>
  );
}

function Row({ item, attached }: { item: LibraryItem; attached: string }) {
  const { open } = useOverlay();
  const isNote = item.kind === 'note';
  const sub = isNote ? item.body : [host(item.url), item.body].filter(Boolean).join(' · ');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', padding: 14, borderRadius: 10, borderBottom: '1px solid rgba(233,200,150,.06)' }}>
      <span className="kindicon" style={{ background: isNote ? 'rgba(217,181,74,.12)' : 'rgba(91,155,224,.12)' }} aria-hidden="true">
        {isNote ? <Icon.note size={18} color="#e4c66a" /> : <Icon.link size={18} color="#8fb8ea" />}
      </span>
      <span style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        {isNote || !item.url ? (
          <button type="button" className="linkbtn" style={{ color: 'var(--bone)', fontSize: 16, textAlign: 'left' }} onClick={() => open({ kind: 'library', id: item.id })}>
            {item.title}
          </button>
        ) : (
          <a href={item.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: 'var(--bone)', textDecoration: 'none' }}>
            {item.title} <Icon.external size={13} color="var(--dust)" />
          </a>
        )}
        {sub && (
          <span style={{ fontSize: 14, color: 'var(--dust)', whiteSpace: isNote ? 'pre-wrap' : undefined, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {sub}
          </span>
        )}
      </span>
      {attached && <span className="pill main">{attached}</span>}
      <span className="pill">{item.category}</span>
      <ItemActions item={item} />
    </div>
  );
}

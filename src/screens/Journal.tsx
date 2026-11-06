import { useSearchParams } from 'react-router';
import { Page } from '../components/Shell';
import { Avatar, EmptyState } from '../components/ui';
import { JournalPage } from '../components/domain';
import { useOverlay } from '../components/overlay';
import { useCharacters, useJournal } from '../db/hooks';
import { CLASS_COLOR } from '../lib/gamedata';
import { formatDate, fullName } from '../lib/logic';

export function Journal() {
  const { open } = useOverlay();
  const [params, setParams] = useSearchParams();
  const chars = useCharacters();
  const all = useJournal();
  if (!chars || !all) return null;

  const cFilter = params.get('c');
  const tFilter = params.get('t');
  const setF = (k: 'c' | 't', v: string | null) => {
    const n = new URLSearchParams(params);
    if (v === null) n.delete(k);
    else n.set(k, v);
    setParams(n, { replace: true });
  };

  const published = all.filter((e) => !e.draft);
  const drafts = all.filter((e) => e.draft);
  const byChar = cFilter ? published.filter((e) => e.characterId === cFilter) : published;
  const entries = tFilter ? byChar.filter((e) => e.tags.includes(tFilter)) : byChar;

  const tagCounts = new Map<string, number>();
  for (const e of byChar) for (const t of e.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const main = chars.find((c) => c.isMain && c.status === 'active') ?? chars[0];
  const first = published[published.length - 1];

  return (
    <Page
      variant="journal"
      title="Journal"
      eyebrow={
        published.length
          ? `${published.length} entr${published.length === 1 ? 'y' : 'ies'} since ${formatDate(first.date)}`
          : 'The story of the journey'
      }
      actions={
        <button type="button" className="btn" onClick={() => open({ kind: 'journal' })}>
          Write an entry
        </button>
      }
    >
      <div className="split" style={{ gap: 28 }}>
        <aside className="card" aria-label="Filters" style={{ flex: '1 1 250px', padding: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="eyebrow" style={{ padding: '8px 12px 6px', color: 'var(--dust)' }}>
            Characters
          </span>
          <button type="button" className="filt" aria-pressed={!cFilter} onClick={() => setF('c', null)}>
            <span>All</span>
            <span className="tab">{published.length}</span>
          </button>
          {chars.map((c) => {
            const n = published.filter((e) => e.characterId === c.id).length;
            if (!n && c.status === 'retired') return null;
            return (
              <button key={c.id} type="button" className="filt" aria-pressed={cFilter === c.id} onClick={() => setF('c', cFilter === c.id ? null : c.id)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span className="dot" style={{ background: CLASS_COLOR[c.class] }} />
                  <span className="ellipsis">{fullName(c)}</span>
                </span>
                <span className="tab">{n}</span>
              </button>
            );
          })}
          {tags.length > 0 && (
            <>
              <span className="eyebrow" style={{ padding: '18px 12px 6px', color: 'var(--dust)' }}>
                Tags
              </span>
              {tags.map(([t, n]) => (
                <button key={t} type="button" className="filt" aria-pressed={tFilter === t} onClick={() => setF('t', tFilter === t ? null : t)}>
                  <span style={{ textTransform: 'capitalize' }}>{t}</span>
                  <span className="tab">{n}</span>
                </button>
              ))}
            </>
          )}
        </aside>

        <div style={{ flex: '999 1 640px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>
          <button
            type="button"
            className="card"
            onClick={() => open({ kind: 'journal', preset: { characterId: (cFilter ?? main?.id) || undefined } })}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', textAlign: 'left', cursor: 'pointer', color: 'var(--bone)', font: 'inherit' }}
          >
            {main && <Avatar c={main} size={40} showLevel={false} quiet />}
            <span className="grow ital" style={{ fontSize: 19, color: 'var(--ash)' }}>
              What happened tonight{main ? `, ${main.firstName}` : ''}?
            </span>
            <span className="help">
              Press <span className="kbd">J</span>
            </span>
          </button>

          {drafts.length > 0 && (
            <section className="card card-pad" aria-labelledby="j-drafts" style={{ gap: 8 }}>
              <h2 id="j-drafts" className="eyebrow">
                Drafts · finish them later
              </h2>
              {drafts.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="listrow"
                  onClick={() => open({ kind: 'journal', id: d.id })}
                  style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid rgba(233,200,150,.07)', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span className="grow" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span className="ellipsis" style={{ fontWeight: 600 }}>
                      {d.title || d.body.split('\n')[0] || 'Untitled draft'}
                    </span>
                    <span className="help">{formatDate(d.date)}</span>
                  </span>
                  <span className="linkbtn">Finish</span>
                </button>
              ))}
            </section>
          )}

          {entries.length === 0 ? (
            <section className="card">
              {published.length === 0 ? (
                <EmptyState
                  title="No entries yet"
                  action={
                    <button type="button" className="btn" onClick={() => open({ kind: 'journal' })}>
                      Write the first entry
                    </button>
                  }
                >
                  First kills, deaths, PvP ambushes, friendly strangers. Write it down while it's fresh. Screenshots welcome.
                </EmptyState>
              ) : (
                <EmptyState title="Nothing matches">Try another character or tag.</EmptyState>
              )}
            </section>
          ) : (
            entries.map((e, i) => (
              <JournalPage
                key={e.id}
                entry={e}
                character={chars.find((c) => c.id === e.characterId)}
                tilt={[-0.4, 0.3, -0.2][i % 3]}
                onEdit={() => open({ kind: 'journal', id: e.id })}
                footer={
                  <div style={{ marginTop: 4 }}>
                    <button type="button" className="parch-btn" style={{ minHeight: 36 }} onClick={() => open({ kind: 'journal', id: e.id })}>
                      Edit
                    </button>
                  </div>
                }
              />
            ))
          )}
        </div>
      </div>
    </Page>
  );
}

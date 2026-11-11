import { useSearchParams } from 'react-router';
import { Page } from '../components/Shell';
import { Avatar, EmptyState, Frame, Rivets } from '../components/ui';
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
      <div className="split">
        <aside className="card" aria-label="Filters" style={{ flex: '1 1 250px', padding: '38px 14px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Rivets bottom={false} />
          <h2 className="plaque" aria-hidden="true">
            Filter
          </h2>
          <span className="filt-head">Characters</span>
          <button type="button" className="filt" aria-pressed={!cFilter} onClick={() => setF('c', null)}>
            <span>All</span>
            <span className="tab">{published.length}</span>
          </button>
          {chars.map((c) => {
            const n = published.filter((e) => e.characterId === c.id).length;
            if (!n && c.status === 'retired') return null;
            return (
              <button key={c.id} type="button" className="filt" aria-pressed={cFilter === c.id} onClick={() => setF('c', cFilter === c.id ? null : c.id)}>
                <span className="ellipsis" style={{ color: CLASS_COLOR[c.class] }}>
                  {fullName(c)}
                </span>
                <span className="tab">{n}</span>
              </button>
            );
          })}
          {tags.length > 0 && (
            <>
              <span className="filt-head" style={{ paddingTop: 16 }}>
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

        <div style={{ flex: '999 1 640px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 44 }}>
          <button
            type="button"
            className="tip"
            onClick={() => open({ kind: 'journal', preset: { characterId: (cFilter ?? main?.id) || undefined } })}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
          >
            {main && <Avatar c={main} size={44} showLevel={false} quiet />}
            <span className="grow ital" style={{ fontSize: 19, color: 'var(--muted)' }}>
              What happened tonight{main ? `, ${main.firstName}` : ''}?
            </span>
            <span className="help">
              Press <span className="kbd">J</span>
            </span>
          </button>

          {drafts.length > 0 && (
            <Frame title="Drafts · finish them later" titleId="j-drafts" style={{ gap: 4 }}>
              {drafts.map((d) => (
                <button key={d.id} type="button" className="listrow" onClick={() => open({ kind: 'journal', id: d.id })}>
                  <span className="grow" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span className="ellipsis" style={{ fontWeight: 700 }}>
                      {d.title || d.body.split('\n')[0] || 'Untitled draft'}
                    </span>
                    <span className="help">{formatDate(d.date)}</span>
                  </span>
                  <span className="linkbtn">Finish</span>
                </button>
              ))}
            </Frame>
          )}

          {entries.length === 0 ? (
            published.length === 0 ? (
              <EmptyState
                framed
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
              <EmptyState framed title="Nothing matches">
                Try another character or tag.
              </EmptyState>
            )
          ) : (
            <section className="board plank" aria-label="Entries" style={{ display: 'flex', flexDirection: 'column', gap: 30, padding: '52px 28px 32px' }}>
              <h2 className="plaque" aria-hidden="true">
                Tales of {(chars.find((c) => c.id === cFilter) ?? main)?.firstName ?? 'the Horde'}
              </h2>
              {entries.map((e, i) => (
                <JournalPage
                  key={e.id}
                  entry={e}
                  character={chars.find((c) => c.id === e.characterId)}
                  tilt={[-0.6, 0.5, -0.3][i % 3]}
                  onEdit={() => open({ kind: 'journal', id: e.id })}
                  footer={
                    <div style={{ marginTop: 4 }}>
                      <button type="button" className="btn2 sm" onClick={() => open({ kind: 'journal', id: e.id })}>
                        Edit
                      </button>
                    </div>
                  }
                />
              ))}
            </section>
          )}
        </div>
      </div>
    </Page>
  );
}

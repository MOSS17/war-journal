import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Page } from '../components/Shell';
import { Avatar, Bar, Check, DiffDot, EmptyState, Money, SectionHead } from '../components/ui';
import { JournalPage, PlanMini, countdownText, eventWhen, nextCountdown, upcoming } from '../components/domain';
import { ParchGrain } from '../components/Skyline';
import { Mark } from '../components/icons';
import { useOverlay } from '../components/overlay';
import { useEvents, useInstances, useJournal, usePlanContext, usePlans, useTonight } from '../db/hooks';
import { addTonightTask, deleteTonightTask, setMain, toggleTonightTask, visibleTonight } from '../db/actions';
import { difficulty, fitsLevel, formatDate, isLocked, levelRange, planProgress, todayISO } from '../lib/logic';
import type { Character } from '../lib/types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

const stat: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 12,
  background: 'rgba(15,12,11,.6)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(233,200,150,.12)',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

function FirstRun() {
  const { open } = useOverlay();
  return (
    <Page
      variant="home"
      hero={
        <div className="pagehead" style={{ paddingBottom: 36 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="eyebrow" style={{ color: 'var(--link)' }}>
              {formatDate(todayISO(), 'long')}
            </span>
            <h1 style={{ fontSize: 60 }}>Lok'tar.</h1>
            <span style={{ fontSize: 18, color: '#e3d2b8' }}>The fires are lit. Who rides out tonight?</span>
          </div>
        </div>
      }
    >
      <section className="card" style={{ maxWidth: 720 }}>
        <EmptyState
          title="Add your first character"
          action={
            <button type="button" className="btn" onClick={() => open({ kind: 'character' })}>
              + Add your first character
            </button>
          }
        >
          Start with your main: first and last name, race, class and ruleset. Then track dungeons, set war plans and keep a journal
          of the journey. The 29 dungeons and 3 raids are already in the Instances list.
        </EmptyState>
      </section>
    </Page>
  );
}

function MainCard({ main, others }: { main: Character; others: Character[] }) {
  const { open } = useOverlay();
  const profs = useLiveQuery(
    async () => (await db.professions.where('characterId').equals(main.id).toArray()).sort((a, b) => b.skill - a.skill).slice(0, 2),
    [main.id],
  );
  return (
    <section className="card card-pad" aria-label="Main character" style={{ gap: 20 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <Avatar c={main} size={76} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <span className="disp" style={{ fontSize: 26, color: 'var(--bone-hi)' }}>
            {main.firstName} <span style={{ color: 'var(--brass)' }}>{main.lastName}</span>
          </span>
          <span className="muted">
            {main.race} {main.class}
            {main.guild ? ` · <${main.guild}>` : ''} · {main.ruleset}
          </span>
        </div>
      </div>
      {main.level < 60 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="barlabel">
            <span style={{ fontWeight: 600 }}>Experience</span>
            <span className="tab muted">
              {main.xpPct}% to {main.level + 1}
            </span>
          </div>
          <Bar pct={main.xpPct / 100} kind="xp" height={8} label="Experience" />
        </div>
      )}
      {profs && profs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          {profs.map((p) => (
            <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="barlabel">
                <span>{p.name}</span>
                <span className="tab muted">{p.skill}</span>
              </div>
              <Bar pct={p.skill / 300} label={`${p.name} skill`} />
            </div>
          ))}
        </div>
      )}
      <div className="row-gap">
        <Link to={`/characters/${main.id}`} className="btn2">
          View character
        </Link>
        <button type="button" className="btn2" onClick={() => open({ kind: 'progress', characterId: main.id })}>
          Update progress
        </button>
        {others.length > 0 && (
          <label style={{ marginLeft: 'auto' }}>
            <span className="sr-only">Switch main character</span>
            <select
              className="inp"
              style={{ height: 44, width: 'auto' }}
              value=""
              onChange={(e) => e.target.value && setMain(e.target.value)}
            >
              <option value="">Switch main…</option>
              {others.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} · {c.level}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </section>
  );
}

export function TonightList({ compact = false }: { compact?: boolean }) {
  const tasks = useTonight();
  const [text, setText] = useState('');
  const list = visibleTonight(tasks ?? []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {list.map((t) =>
        compact ? (
          <button key={t.id} type="button" className="tick" aria-pressed={t.done} onClick={() => toggleTonightTask(t)}>
            <span className={`cb${t.done ? ' on' : ''}`}>{t.done && <CheckMark />}</span>
            <span className="tick-text">{t.text}</span>
          </button>
        ) : (
          <div key={t.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div className="grow">
              <Check checked={t.done} onChange={() => toggleTonightTask(t)}>
                {t.text}
              </Check>
            </div>
            <button type="button" className="iconbtn" aria-label={`Remove ${t.text}`} onClick={() => deleteTonightTask(t.id)}>
              ×
            </button>
          </div>
        ),
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addTonightTask(text);
          setText('');
        }}
        style={{ display: 'flex', gap: 8 }}
      >
        <label className="sr-only" htmlFor={compact ? 'tn-g' : 'tn-b'}>
          Add to tonight's plan
        </label>
        <input
          id={compact ? 'tn-g' : 'tn-b'}
          className="inp grow"
          style={{ height: compact ? 46 : 42 }}
          placeholder={list.length ? 'Add another…' : 'e.g. Turn in Tarren Mill quests'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn2 sm" style={{ minHeight: compact ? 46 : 42 }} disabled={!text.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}

function CheckMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f0c0b" strokeWidth="3.2" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

export function WarBoard() {
  const { open } = useOverlay();
  const navigate = useNavigate();
  const ctx = usePlanContext();
  const plans = usePlans();
  const events = useEvents();
  const journal = useJournal();
  const instances = useInstances();
  const today = todayISO();

  if (!ctx || !plans || !events || !journal || !instances) return null;
  const active = ctx.characters.filter((c) => c.status === 'active');
  if (active.length === 0) return <FirstRun />;
  const main = active.find((c) => c.isMain) ?? active[0];

  const tracked = plans
    .filter((p) => p.status === 'active' && p.tracked)
    .map((p) => ({ plan: p, prog: planProgress(p, ctx) }))
    .sort((a, b) => a.plan.createdAt.localeCompare(b.plan.createdAt));
  const next = nextCountdown(events, today);
  const horizon = upcoming(events, today).slice(0, 4);
  const latest = journal.find((e) => !e.draft);
  const drafts = journal.filter((e) => e.draft).length;
  const cleared = new Set(ctx.progress.filter((p) => p.characterId === main.id && p.status === 'cleared').map((p) => p.instanceId));
  const fits = instances
    .filter((i) => i.kind === 'dungeon' && fitsLevel(i, main.level) && !cleared.has(i.id) && !isLocked(i, today))
    .slice(0, 5);
  const top = tracked[0];

  return (
    <Page
      variant="home"
      title="War Board"
      hero={
        <div className="pagehead" style={{ paddingBottom: 36, gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="eyebrow" style={{ color: 'var(--link)' }}>
              {formatDate(today, 'long')}
            </span>
            <h1 style={{ fontSize: 'clamp(40px, 6vw, 60px)', textWrap: 'balance' }}>Lok'tar, {main.firstName}.</h1>
            <span style={{ fontSize: 18, color: '#e3d2b8' }}>
              {top ? `The fires are lit. ${top.plan.title} is waiting.` : 'The fires are lit. What will you fight for tonight?'}
            </span>
          </div>
          <div className="row-gap">
            <div style={stat}>
              <span className="eyebrow" style={{ fontSize: 11 }}>
                Level
              </span>
              <span className="disp tab" style={{ fontSize: 26, color: 'var(--bone-hi)' }}>
                {main.level}
              </span>
            </div>
            <div style={stat}>
              <span className="eyebrow" style={{ fontSize: 11 }}>
                Gold
              </span>
              <Money copper={main.copper} size={22} />
            </div>
            {next && (
              <div style={{ ...stat, background: 'rgba(184,50,42,.3)', border: '1px solid rgba(224,118,58,.4)' }}>
                <span className="eyebrow" style={{ fontSize: 11, color: '#f2b48a' }}>
                  {next.title}
                </span>
                <span className="disp tab" style={{ fontSize: 26, color: 'var(--bone-hi)' }}>
                  {countdownText(next, today)}
                </span>
              </div>
            )}
          </div>
        </div>
      }
    >
      <div className="grid-auto">
        <MainCard main={main} others={active.filter((c) => c.id !== main.id)} />

        <section className="card card-pad" aria-labelledby="wb-plans">
          <SectionHead
            id="wb-plans"
            title="Tracked plans"
            right={
              <Link to="/plans" className="linkbtn">
                War Plans
              </Link>
            }
          />
          {tracked.length ? (
            tracked.slice(0, 5).map(({ plan, prog }) => <PlanMini key={plan.id} plan={plan} prog={prog} />)
          ) : (
            <EmptyState
              title="Nothing tracked"
              action={
                <button type="button" className="btn2" onClick={() => open({ kind: 'plan' })}>
                  + New war plan
                </button>
              }
            >
              Set a goal (a dungeon, a level, a gold target) and track it here.
            </EmptyState>
          )}
        </section>

        <section className="card card-pad" aria-labelledby="wb-fits" style={{ gap: 12 }}>
          <SectionHead
            id="wb-fits"
            title="Dungeons for you"
            right={
              <Link to="/instances?fits=1" className="linkbtn">
                All
              </Link>
            }
          />
          {fits.length ? (
            <div>
              {fits.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="listrow"
                  onClick={() => navigate(`/instances?i=${d.id}`)}
                  style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid rgba(233,200,150,.07)', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                >
                  <DiffDot d={difficulty(d.levelMin, d.levelMax, main.level)} glow={false} />
                  <span className="grow" style={{ fontWeight: 600 }}>
                    {d.name}
                  </span>
                  {d.isNewInForever && <span className="pill new">New</span>}
                  <span className="pill tab">{levelRange(d)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">Every dungeon in range is cleared. Time to level up.</p>
          )}
          <span className="help">Dot colour shows difficulty for level {main.level}.</span>
        </section>

        <section className="card card-pad" aria-labelledby="wb-tonight">
          <SectionHead
            id="wb-tonight"
            title="Tonight's plan"
            right={
              <a
                href="/glance"
                className="linkbtn"
                onClick={(e) => {
                  e.preventDefault();
                  window.open('/glance', 'war-journal-glance', 'width=440,height=860');
                }}
              >
                Pop out
              </a>
            }
          />
          <TonightList />
        </section>

        <section className="card card-pad" aria-labelledby="wb-horizon" style={{ gap: 4 }}>
          <div style={{ marginBottom: 10 }}>
            <SectionHead
              id="wb-horizon"
              title="On the horizon"
              right={
                <button type="button" className="linkbtn" onClick={() => open({ kind: 'event' })}>
                  + Add date
                </button>
              }
            />
          </div>
          {horizon.length === 0 && <p className="muted">No dates coming up.</p>}
          {horizon.map((e) => {
            const w = eventWhen(e, today);
            return (
              <button
                key={e.id}
                type="button"
                className="listrow"
                onClick={() => open({ kind: 'event', id: e.id })}
                style={{ gap: 16, padding: '14px 0', background: 'none', border: 0, borderBottom: '1px solid rgba(233,200,150,.07)', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left', width: '100%' }}
              >
                <span className="disp tab" style={{ width: 76, flex: 'none', whiteSpace: 'nowrap', fontSize: e.date ? 22 : 15, lineHeight: 1.1, color: e.date ? 'var(--bad)' : 'var(--brass)' }}>
                  {w.big}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{e.title}</span>
                  <span className="muted" style={{ fontSize: 14 }}>
                    {e.date ? `${countdownText(e, today)} · ${e.detail ?? w.small}` : (e.detail ?? w.small)}
                  </span>
                </span>
              </button>
            );
          })}
        </section>

        <section aria-label="Latest journal entry" style={{ gridColumn: '1 / -1' }}>
          {latest ? (
            <JournalPage
              entry={latest}
              character={ctx.characters.find((c) => c.id === latest.characterId)}
              compact
              footer={
                <div className="row-gap" style={{ marginTop: 6 }}>
                  <button type="button" className="btn" onClick={() => open({ kind: 'journal' })}>
                    Write an entry
                  </button>
                  <Link to="/journal" className="parch-btn">
                    Open journal{drafts ? ` · ${drafts} draft${drafts === 1 ? '' : 's'}` : ''}
                  </Link>
                </div>
              }
            />
          ) : (
            <article className="parch" style={{ padding: '30px 34px' }}>
              <ParchGrain />
              <span className="seal" aria-hidden="true">
                <Mark size={24} muted />
              </span>
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span className="ink" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' }}>
                  The journal
                </span>
                <h2 style={{ fontSize: 28 }}>The first page is blank</h2>
                <p className="entry-body">Write down tonight: who you met, what killed you, what you finally cleared.</p>
                <div className="row-gap">
                  <button type="button" className="btn" onClick={() => open({ kind: 'journal' })}>
                    Write an entry
                  </button>
                  {drafts > 0 && (
                    <Link to="/journal" className="parch-btn">
                      {drafts} draft{drafts === 1 ? '' : 's'} waiting
                    </Link>
                  )}
                </div>
              </div>
            </article>
          )}
        </section>
      </div>
    </Page>
  );
}

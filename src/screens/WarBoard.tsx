import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Page } from '../components/Shell';
import { Avatar, Bar, Check, DiffDot, EmptyState, Money, Rivets, SectionHead } from '../components/ui';
import { JournalPage, PlanMini, countdownText, eventWhen, upcoming } from '../components/domain';
import { ParchGrain } from '../components/Skyline';
import { Mark } from '../components/icons';
import { useOverlay } from '../components/overlay';
import { useEvents, useInstances, useJournal, usePlanContext, usePlans, useProfessions, useTonight } from '../db/hooks';
import { addTonightTask, deleteTonightTask, setMain, toggleTonightTask, visibleTonight } from '../db/actions';
import { DIFFICULTY_COLOR, difficulty, fitsLevel, formatDate, fullName, isLocked, levelRange, planProgress, todayISO } from '../lib/logic';
import { CLASS_COLOR } from '../lib/gamedata';
import type { Character } from '../lib/types';

function FirstRun() {
  const { open } = useOverlay();
  return (
    <Page
      variant="home"
      hero={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="eyebrow" style={{ fontSize: 13, letterSpacing: '.2em', color: '#f0c98a' }}>
            {formatDate(todayISO(), 'long')}
          </span>
          <h1 className="title" style={{ fontSize: 'clamp(38px, 6vw, 52px)', lineHeight: 1.05 }}>
            Lok'tar.
          </h1>
          <span className="hero-sub">The fires are lit. Who rides out tonight?</span>
        </div>
      }
    >
      <EmptyState
        framed
        title="Add your first character"
        style={{ maxWidth: 720, margin: '0 auto' }}
        action={
          <button type="button" className="btn" onClick={() => open({ kind: 'character' })}>
            + Add your first character
          </button>
        }
      >
        Start with your main: first and last name, race, class and ruleset. Then track dungeons, set war plans and keep a journal
        of the journey. The 29 dungeons and 3 raids are already in the Instances list.
      </EmptyState>
    </Page>
  );
}

function MainCard({ main, others }: { main: Character; others: Character[] }) {
  const { open } = useOverlay();
  const profs = useProfessions(main.id, (a, b) => b.skill - a.skill)?.slice(0, 2);
  return (
    <section className="card card-pad" aria-label="Main character" style={{ gap: 20, flex: 1 }}>
      <Rivets />
      <h2 className="plaque">Hero of the Horde</h2>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <Avatar c={main} size={112} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span className="title" style={{ fontSize: 30, lineHeight: 1.1, color: CLASS_COLOR[main.class] }}>
            {fullName(main)}
          </span>
          <span style={{ fontSize: 17, textShadow: 'var(--shadow)' }}>
            {main.race} {main.class}
          </span>
          {main.guild && <span style={{ color: 'var(--done)', fontSize: 15, textShadow: 'var(--shadow)' }}>&lt;{main.guild}&gt;</span>}
          <span className="muted" style={{ fontSize: 14 }}>
            {main.ruleset}
          </span>
        </div>
      </div>
      {main.level < 60 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="barlabel">
            <span>Experience</span>
            <span className="tab">
              {main.xpPct}% to {main.level + 1}
            </span>
          </div>
          <Bar pct={main.xpPct / 100} kind="xp" label="Experience" />
        </div>
      )}
      {profs && profs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {profs.map((p) => (
            <div key={p.id} className="tip" style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{p.name}</span>
              <span className="tab" style={{ color: 'var(--gold)' }}>
                {p.skill}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="row-gap" style={{ justifyContent: 'space-between' }}>
        <Money copper={main.copper} />
        <div className="row-gap">
          <Link to={`/characters/${main.id}`} className="btn2">
            View character
          </Link>
          <button type="button" className="btn2" onClick={() => open({ kind: 'progress', characterId: main.id })}>
            Update progress
          </button>
        </div>
      </div>
      {others.length > 0 && (
        <label>
          <span className="sr-only">Switch main character</span>
          <select className="inp" value="" onChange={(e) => e.target.value && setMain(e.target.value)}>
            <option value="">Switch main…</option>
            {others.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} · {c.level}
              </option>
            ))}
          </select>
        </label>
      )}
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
          placeholder={list.length ? 'Add another…' : 'e.g. Turn in Tarren Mill quests'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn2 sm" disabled={!text.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}

function CheckMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" aria-hidden="true">
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="eyebrow" style={{ fontSize: 13, letterSpacing: '.2em', color: '#f0c98a' }}>
            {formatDate(today, 'long')}
          </span>
          <h1 className="title" style={{ fontSize: 'clamp(36px, 5vw, 46px)', lineHeight: 1.05, textWrap: 'balance' }}>
            Lok'tar, {main.firstName}.
          </h1>
          <span className="hero-sub">
            {top ? `The fires are lit. ${top.plan.title} is waiting.` : 'The fires are lit. What will you fight for tonight?'}
          </span>
        </div>
      }
    >
      <div className="stack">
        <div className="split" style={{ alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex' }}>
            <MainCard main={main} others={active.filter((c) => c.id !== main.id)} />
          </div>

          <section className="tracker" aria-labelledby="wb-plans" style={{ flex: '1 1 380px' }}>
            <div className="panel-head">
              <h2 id="wb-plans">Tracked plans</h2>
              <Link to="/plans">War Plans</Link>
            </div>
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
        </div>

        <div className="split">
          <section className="board plank" aria-labelledby="wb-horizon" style={{ flex: '1 1 400px', minWidth: 0 }}>
            <SectionHead
              id="wb-horizon"
              title="On the horizon"
              right={
                <button type="button" className="linkbtn" style={{ minHeight: 44 }} onClick={() => open({ kind: 'event' })}>
                  + Add date
                </button>
              }
            />
            {horizon.length === 0 && (
              <p className="muted" style={{ textAlign: 'center', textShadow: 'var(--shadow)' }}>
                No dates coming up.
              </p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, justifyContent: 'center' }}>
              {horizon.map((e, i) => {
                const w = eventWhen(e, today);
                const big = i === 0 && e.date;
                return (
                  <button
                    key={e.id}
                    type="button"
                    className="notice"
                    onClick={() => open({ kind: 'event', id: e.id })}
                    style={{
                      flex: big ? '1 1 200px' : '1 1 170px',
                      transform: `rotate(${[-2, 1.5, -1, 1][i % 4]}deg)`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: big ? 'center' : 'flex-start',
                      textAlign: big ? 'center' : 'left',
                      gap: 4,
                    }}
                  >
                    <span className="tack" aria-hidden="true" />
                    {big ? (
                      <>
                        <span className="order">{w.big}</span>
                        <span className="big tab">{countdownText(e, today)}</span>
                        <strong>{e.title}</strong>
                        {e.detail && <span style={{ fontSize: 14 }}>{e.detail}</span>}
                      </>
                    ) : (
                      <>
                        <span className="order">
                          {e.date ? `${w.big} · ${countdownText(e, today)}` : w.big}
                        </span>
                        <strong>{e.title}</strong>
                        <span style={{ fontSize: 14 }}>{e.detail ?? w.small}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>
            <section className="tip" aria-labelledby="wb-fits" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="panel-head" style={{ marginBottom: 8 }}>
                <h2 id="wb-fits" style={{ fontSize: 22 }}>
                  Dungeons for you
                </h2>
                <Link to="/instances?fits=1">All</Link>
              </div>
              {fits.length ? (
                <div>
                  {fits.map((d) => {
                    const dd = difficulty(d.levelMin, d.levelMax, main.level);
                    return (
                      <button key={d.id} type="button" className="listrow" onClick={() => navigate(`/instances?i=${d.id}`)}>
                        <DiffDot d={dd} glow={false} />
                        <span className="grow" style={{ fontWeight: 700, color: DIFFICULTY_COLOR[dd], textShadow: 'var(--shadow)' }}>
                          {d.name}
                        </span>
                        {d.isNewInForever && <span className="pill new sm">New</span>}
                        <span className="tab" style={{ color: '#c8c8d0' }}>
                          {levelRange(d)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="muted">Every dungeon in range is cleared. Time to level up.</p>
              )}
              <span className="help" style={{ marginTop: 8, color: 'var(--faint)' }}>
                Dot colour shows difficulty for level {main.level}.
              </span>
            </section>

            <section className="tracker" aria-labelledby="wb-tonight" style={{ gap: 8 }}>
              <div className="panel-head">
                <h2 id="wb-tonight" style={{ fontSize: 22 }}>
                  Tonight's plan
                </h2>
                <a
                  href="/glance"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open('/glance', 'war-journal-glance', 'width=440,height=860');
                  }}
                >
                  Pop out
                </a>
              </div>
              <TonightList />
            </section>
          </div>
        </div>

        <section aria-label="Latest journal entry">
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
                  <Link to="/journal" className="btn2">
                    Open journal{drafts ? ` · ${drafts} draft${drafts === 1 ? '' : 's'}` : ''}
                  </Link>
                </div>
              }
            />
          ) : (
            <article className="parch edged" style={{ padding: '30px 34px' }}>
              <ParchGrain />
              <span className="seal" aria-hidden="true">
                <Mark size={24} muted />
              </span>
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span className="eyebrow" style={{ letterSpacing: '.14em' }}>
                  The journal
                </span>
                <h2 style={{ fontSize: 28 }}>The first page is blank</h2>
                <p className="entry-body">Write down tonight: who you met, what killed you, what you finally cleared.</p>
                <div className="row-gap">
                  <button type="button" className="btn" onClick={() => open({ kind: 'journal' })}>
                    Write an entry
                  </button>
                  {drafts > 0 && (
                    <Link to="/journal" className="btn2">
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

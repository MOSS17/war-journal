import { Link, useSearchParams } from 'react-router';
import { Page } from '../components/Shell';
import { Bar, Check, EmptyState, Rivets } from '../components/ui';
import { Icon } from '../components/icons';
import { ParchGrain } from '../components/Skyline';
import { useOverlay } from '../components/overlay';
import { usePlanContext, usePlans } from '../db/hooks';
import { setPlanStatus, toggleObjective, updatePlan } from '../db/actions';
import { QUALITY_COLOR } from '../lib/gamedata';
import {
  DIFFICULTY_COLOR,
  DIFFICULTY_LABEL,
  formatDate,
  fullName,
  levelRange,
  planProgress,
  todayISO,
  type PlanContext,
  type PlanProgress,
} from '../lib/logic';
import type { Difficulty } from '../lib/logic';
import type { WarPlan } from '../lib/types';
import { ACCOUNT } from '../lib/types';

type Filter = 'active' | 'tracked' | 'done';

const TYPE_LABEL: Record<WarPlan['type'], string> = {
  dungeon: 'Dungeon',
  raid: 'Raid',
  level: 'Level',
  profession: 'Profession',
  gold: 'Gold',
  item: 'Item',
  custom: 'Custom',
};

export function Plans() {
  const { open } = useOverlay();
  const [params, setParams] = useSearchParams();
  const ctx = usePlanContext();
  const plans = usePlans();
  if (!ctx || !plans) return null;

  const filter = (params.get('f') as Filter) || 'active';
  const setFilter = (f: Filter) => {
    const n = new URLSearchParams(params);
    if (f === 'active') n.delete('f');
    else n.set('f', f);
    setParams(n, { replace: true });
  };

  const withProg = plans.map((p) => ({ plan: p, prog: planProgress(p, ctx) }));
  const matches = withProg
    .filter(({ plan }) =>
      filter === 'done' ? plan.status !== 'active' : filter === 'tracked' ? plan.status === 'active' && plan.tracked : plan.status === 'active',
    )
    .sort((a, b) =>
      filter === 'done'
        ? (b.plan.completedAt ?? b.plan.updatedAt).localeCompare(a.plan.completedAt ?? a.plan.updatedAt)
        : (a.prog.level ?? 0) - (b.prog.level ?? 0) || a.plan.createdAt.localeCompare(b.plan.createdAt),
    );

  const owners = [...ctx.characters.map((c) => c.id), ACCOUNT];
  const groups = owners
    .map((o) => ({ owner: o, items: matches.filter((m) => m.plan.ownerId === o) }))
    .filter((g) => g.items.length);

  const selectedId = params.get('p');
  const selected = withProg.find((x) => x.plan.id === selectedId) ?? matches[0];
  const activeCount = plans.filter((p) => p.status === 'active').length;

  const select = (id: string) => {
    const n = new URLSearchParams(params);
    n.set('p', id);
    setParams(n, { replace: true });
  };

  return (
    <Page
      variant="plans"
      title="War Plans"
      eyebrow={plans.length ? `${activeCount} active of ${plans.length} plans` : 'Personal goals, not in-game quests'}
      actions={
        <button type="button" className="btn" onClick={() => open({ kind: 'plan' })}>
          + New plan
        </button>
      }
    >
      {plans.length === 0 ? (
          <EmptyState
            framed
            title="No war plans yet"
            action={
              <button type="button" className="btn" onClick={() => open({ kind: 'plan' })}>
                + New war plan
              </button>
            }
          >
            Pick something to work toward: clear a dungeon, reach a level, hit a profession skill or save for your mount. Dungeon
            plans fill in their wings and tick themselves off as you mark progress.
          </EmptyState>
      ) : (
        <section className="card card-pad" aria-label="War Plans" style={{ gap: 16 }}>
          <Rivets />
          <h2 className="plaque" aria-hidden="true">
            War Plans
          </h2>
          <div role="group" aria-label="Filter" className="filterbar" style={{ maxWidth: 420, margin: 0 }}>
            {(['active', 'tracked', 'done'] as Filter[]).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className="split" style={{ gap: 16, alignItems: 'stretch' }}>
            <div className="well" aria-label="Plans" role="region" style={{ flex: '1 1 340px', padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              {groups.length === 0 && (
                <p className="muted" style={{ padding: '12px 14px' }}>
                  {filter === 'done' ? 'Nothing finished yet. Keep going.' : filter === 'tracked' ? 'No tracked plans. Track one to see it on the War Board.' : 'No active plans.'}
                </p>
              )}
              {groups.map((g) => {
                const c = ctx.characters.find((x) => x.id === g.owner);
                return (
                  <div key={g.owner} style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 8 }}>
                    <span className="qgroup">
                      <span className="box" aria-hidden="true">
                        –
                      </span>
                      {c ? `${fullName(c)} · ${c.race} ${c.class}` : 'Whole warband'}
                    </span>
                    {g.items.map(({ plan, prog }) => {
                      const lvl = prog.level ?? plan.level;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          className="qrow"
                          aria-current={selected?.plan.id === plan.id}
                          onClick={() => select(plan.id)}
                          style={{ color: plan.status === 'active' ? DIFFICULTY_COLOR[prog.difficulty] : '#9d9d9d' }}
                        >
                          {lvl ? (
                            <span className="tab" style={{ minWidth: 36 }}>
                              [{lvl}]
                            </span>
                          ) : null}
                          <span className="grow ellipsis" style={{ textDecoration: plan.status === 'abandoned' ? 'line-through' : undefined }}>
                            {plan.title}
                          </span>
                          <span className="sr-only">· {DIFFICULTY_LABEL[prog.difficulty]}</span>
                          <span className="tab" style={{ fontFamily: 'var(--f-ui)', fontWeight: 500, fontSize: 13, color: 'var(--muted)' }}>
                            {plan.status === 'done' ? 'Done' : plan.status === 'abandoned' ? 'Abandoned' : plan.tracked ? 'Tracked' : prog.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              <div className="legend" style={{ marginTop: 'auto' }} aria-hidden="true">
                {(['trivial', 'easy', 'even', 'hard', 'deadly'] as Difficulty[]).map((d) => (
                  <span key={d} style={{ color: DIFFICULTY_COLOR[d], textShadow: 'var(--shadow)' }}>
                    {DIFFICULTY_LABEL[d]}
                  </span>
                ))}
              </div>
            </div>

            {selected ? (
              <PlanDetail key={selected.plan.id} plan={selected.plan} prog={selected.prog} ctx={ctx} />
            ) : (
              <div className="parch" style={{ flex: '999 1 460px', padding: '28px 32px' }}>
                <EmptyState title="Pick a plan">Select a plan on the left to see its objectives.</EmptyState>
              </div>
            )}
          </div>
        </section>
      )}
    </Page>
  );
}

function PlanDetail({ plan, prog, ctx }: { plan: WarPlan; prog: PlanProgress; ctx: PlanContext }) {
  const { open, toast, celebrate } = useOverlay();
  const owner = ctx.characters.find((c) => c.id === plan.ownerId);
  const inst = ctx.instances.find((i) => i.id === plan.target.instanceId);
  const diffColor = DIFFICULTY_COLOR[prog.difficulty];
  const isNumeric = ['level', 'profession', 'gold'].includes(plan.type);
  const today = todayISO();
  const overdue = plan.status === 'active' && plan.dueDate && plan.dueDate < today;

  const complete = async () => {
    await setPlanStatus(plan.id, 'done');
    celebrate([plan.title]);
  };

  return (
    <article
      className="parch"
      aria-label="Selected plan"
      style={{ flex: '999 1 460px', minWidth: 0, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 14, border: '2px solid var(--sunk-edge)' }}
    >
      <ParchGrain />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="sect" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 32px)', lineHeight: 1.1, textWrap: 'balance' }}>{plan.title}</h2>
          <span className="pill" style={{ fontSize: 13, minHeight: 28 }}>
            {TYPE_LABEL[plan.type]} · {owner ? fullName(owner) : 'Whole warband'}
          </span>
        </div>
        <div className="row-gap" style={{ gap: 6 }}>
          {plan.status === 'active' ? (
            <span className="pill" style={{ color: diffColor }}>
              {DIFFICULTY_LABEL[prog.difficulty]}
              {owner ? ` · Lv ${owner.level}` : ''}
            </span>
          ) : (
            <span className="pill" style={plan.status === 'done' ? { color: 'var(--done)' } : undefined}>
              {plan.status === 'done' ? `Done${plan.completedAt ? ` · ${formatDate(plan.completedAt.slice(0, 10))}` : ''}` : 'Abandoned'}
            </span>
          )}
          {plan.tracked && plan.status === 'active' && <span className="pill">Tracked</span>}
          {plan.dueDate && (
            <span className="pill" style={overdue ? { color: '#ff8040' } : undefined}>
              {overdue ? 'Overdue · ' : 'By '}
              {formatDate(plan.dueDate)}
            </span>
          )}
        </div>
        {plan.notes && (
          <p style={{ fontFamily: 'var(--f-ink)', fontSize: 17, lineHeight: 1.55, maxWidth: '60ch', whiteSpace: 'pre-wrap' }}>{plan.notes}</p>
        )}

        <h3 style={{ marginTop: 6, fontSize: 21 }}>{isNumeric ? 'Progress' : 'Objectives'}</h3>
        {prog.objectives.length > 0 && (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {prog.objectives.map((o) => (
              <li key={o.id}>
                <Check
                  checked={o.done}
                  disabled={plan.status !== 'active'}
                  right={o.doneAt ? formatDate(o.doneAt) : undefined}
                  onChange={async (v) => {
                    const done = await toggleObjective(plan, o, v);
                    celebrate(done);
                  }}
                >
                  {o.text}
                </Check>
              </li>
            ))}
          </ul>
        )}
        {!isNumeric && prog.objectives.length === 0 && (
          <p style={{ fontFamily: 'var(--f-ink)', fontSize: 16 }}>
            {inst ? `${inst.name} has no wings or bosses listed, so this completes when you mark it cleared.` : 'No objectives. Mark it complete when it’s done.'}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="sect" style={{ fontFamily: 'var(--f-label)', fontWeight: 700, fontSize: 14, color: 'var(--ink-head)' }}>
            <span>{isNumeric ? '' : 'Progress'}</span>
            <span className="tab">{prog.label}</span>
          </div>
          <Bar pct={prog.pct} label="Plan progress" />
        </div>
        {isNumeric && (
          <p className="help" style={{ fontSize: 14 }}>
            {plan.type === 'level' && 'Updates when you log a new level.'}
            {plan.type === 'profession' && `Updates when you log ${plan.target.profession} skill.`}
            {plan.type === 'gold' && (plan.ownerId === ACCOUNT ? 'Counts gold across your active characters.' : 'Updates when you log gold.')}
            {plan.status === 'active' && (
              <>
                {' '}
                <button type="button" className="linkbtn" onClick={() => open({ kind: 'progress', characterId: owner?.id })}>
                  Update progress
                </button>
              </>
            )}
          </p>
        )}
        {inst && plan.status === 'active' && (
          <button type="button" className="btn2 sm" style={{ alignSelf: 'flex-start' }} onClick={() => open({ kind: 'instanceProgress', instanceId: inst.id, characterId: owner?.id })}>
            Mark {inst.kind} progress
          </button>
        )}
        {inst && (
          <Link to={`/instances?i=${inst.id}`}>
            Linked: {inst.name} · {levelRange(inst)} →
          </Link>
        )}

        <h3 style={{ marginTop: 6, fontSize: 21 }}>Rewards</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {(plan.reward || plan.type === 'item') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px 6px 6px', background: 'rgba(58,26,8,.12)', border: '1px solid #8a6d3f', borderRadius: 3 }}>
              <span
                className="reward-slot"
                aria-hidden="true"
                style={{
                  borderColor: QUALITY_COLOR[plan.rewardQuality ?? 'epic'],
                  boxShadow: `0 0 8px ${QUALITY_COLOR[plan.rewardQuality ?? 'epic']}`,
                }}
              />
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--f-ink)', fontWeight: 700 }}>[{plan.reward ?? plan.target.item}]</span>
                <span className="help">{plan.rewardQuality ? plan.rewardQuality[0].toUpperCase() + plan.rewardQuality.slice(1) : 'Your reward'}</span>
              </span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px 6px 6px', background: 'rgba(58,26,8,.12)', border: '1px solid #8a6d3f', borderRadius: 3 }}>
            <span className="reward-slot" aria-hidden="true" style={{ background: 'radial-gradient(circle at 40% 35%, #c9a24a, #5a3a10)', borderColor: '#8a6d3f' }}>
              <Icon.scroll size={20} color="#2b1a0c" />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontFamily: 'var(--f-ink)', fontWeight: 700 }}>A journal entry</span>
              <span className="help">Prompted when you complete it</span>
            </span>
          </div>
        </div>

        <div style={{ marginTop: 8, paddingTop: 14, borderTop: '1px solid rgba(58,26,8,.35)', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="row-gap" style={{ gap: 6 }}>
            {plan.status === 'active' && (
              <button
                type="button"
                className="btn2 quiet"
                onClick={async () => {
                  await setPlanStatus(plan.id, 'abandoned');
                  toast(`Abandoned: ${plan.title}`, { label: 'Undo', run: () => setPlanStatus(plan.id, 'active') });
                }}
              >
                Abandon
              </button>
            )}
            <button type="button" className="btn2 quiet" onClick={() => open({ kind: 'plan', id: plan.id })}>
              Edit
            </button>
          </div>
          <div className="row-gap">
            {plan.status === 'active' ? (
              <>
                <button type="button" className="btn2" onClick={() => updatePlan(plan.id, { tracked: !plan.tracked })}>
                  {plan.tracked ? 'Untrack' : 'Track'}
                </button>
                <button type="button" className="btn" onClick={complete}>
                  Mark complete
                </button>
              </>
            ) : (
              <button type="button" className="btn2" onClick={() => setPlanStatus(plan.id, 'active')}>
                Reopen
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

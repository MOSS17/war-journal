import { Link, useSearchParams } from 'react-router';
import { Page } from '../components/Shell';
import { Bar, Check, DiffDot, EmptyState } from '../components/ui';
import { Icon } from '../components/icons';
import { useOverlay } from '../components/overlay';
import { usePlanContext, usePlans } from '../db/hooks';
import { setPlanStatus, toggleObjective, updatePlan } from '../db/actions';
import { CLASS_COLOR, QUALITY_COLOR } from '../lib/gamedata';
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
        <section className="card">
          <EmptyState
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
        </section>
      ) : (
        <div className="split">
          <section className="card" aria-label="Plans" style={{ flex: '1 1 360px', padding: 14, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <div role="group" aria-label="Filter" className="filterbar">
              {(['active', 'tracked', 'done'] as Filter[]).map((f) => (
                <button key={f} type="button" className={`btn2${filter === f ? '' : ' quiet'}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {f[0].toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            {groups.length === 0 && (
              <p className="muted" style={{ padding: '12px 14px' }}>
                {filter === 'done' ? 'Nothing finished yet. Keep going.' : filter === 'tracked' ? 'No tracked plans. Track one to see it on the War Board.' : 'No active plans.'}
              </p>
            )}
            {groups.map((g) => {
              const c = ctx.characters.find((x) => x.id === g.owner);
              return (
                <div key={g.owner} style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 10 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: c ? CLASS_COLOR[c.class] : 'var(--brass)' }} />
                    <span className="eyebrow" style={{ color: 'var(--ash)' }}>
                      {c ? `${fullName(c)} · ${c.race} ${c.class}` : 'Whole warband'}
                    </span>
                  </span>
                  {g.items.map(({ plan, prog }) => (
                    <button key={plan.id} type="button" className="qrow" aria-current={selected?.plan.id === plan.id} onClick={() => select(plan.id)}>
                      <DiffDot d={prog.difficulty} />
                      <span className="grow ellipsis" style={{ color: plan.status !== 'active' ? 'var(--dust)' : undefined, textDecoration: plan.status === 'abandoned' ? 'line-through' : undefined }}>
                        {plan.title}
                      </span>
                      {plan.tracked && plan.status === 'active' && (
                        <span title="Tracked" style={{ display: 'flex' }}>
                          <Icon.arrowUp size={14} color="#e0763a" />
                          <span className="sr-only">Tracked</span>
                        </span>
                      )}
                      <span className="tab" style={{ fontSize: 13, fontWeight: 500, color: 'var(--dust)' }}>
                        {plan.status === 'done' ? 'Done' : plan.status === 'abandoned' ? 'Abandoned' : prog.level ? `Lv ${prog.level}` : prog.label}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </section>

          {selected ? (
            <PlanDetail key={selected.plan.id} plan={selected.plan} prog={selected.prog} ctx={ctx} />
          ) : (
            <section className="card" style={{ flex: '999 1 560px' }}>
              <EmptyState title="Pick a plan">Select a plan on the left to see its objectives.</EmptyState>
            </section>
          )}
        </div>
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
    <article className="card" aria-label="Selected plan" style={{ flex: '999 1 560px', padding: 0, overflow: 'hidden', minWidth: 0 }}>
      <div
        style={{
          padding: '30px 32px 24px',
          background: 'radial-gradient(ellipse 80% 120% at 100% 0%, rgba(184,50,42,.22), transparent 60%)',
          borderBottom: '1px solid rgba(233,200,150,.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div className="row-gap" style={{ gap: 8 }}>
          {plan.status === 'active' ? (
            <span className="pill" style={{ background: `${diffColor}24`, color: diffColor }}>
              <DiffDot d={prog.difficulty} size={7} glow={false} />
              {DIFFICULTY_LABEL[prog.difficulty]}
              {owner ? ` · Lv ${owner.level}` : ''}
            </span>
          ) : (
            <span className={`pill ${plan.status === 'done' ? 'cleared' : ''}`}>
              {plan.status === 'done' ? `Done${plan.completedAt ? ` · ${formatDate(plan.completedAt.slice(0, 10))}` : ''}` : 'Abandoned'}
            </span>
          )}
          <span className="pill">{TYPE_LABEL[plan.type]}</span>
          <span className="pill">{owner ? owner.firstName : 'Whole warband'}</span>
          {plan.tracked && plan.status === 'active' && <span className="pill main">Tracked</span>}
          {plan.dueDate && (
            <span className={`pill${overdue ? ' new' : ''}`}>
              {overdue ? 'Overdue · ' : 'By '}
              {formatDate(plan.dueDate)}
            </span>
          )}
        </div>
        <h2 className="disp" style={{ fontSize: 'clamp(28px, 4vw, 38px)', lineHeight: 1.05, color: 'var(--bone-hi)' }}>
          {plan.title}
        </h2>
        {plan.notes && (
          <p className="serif" style={{ fontSize: 19, lineHeight: 1.55, color: '#e3d6c0', maxWidth: '60ch', whiteSpace: 'pre-wrap' }}>
            {plan.notes}
          </p>
        )}
      </div>

      <div style={{ padding: '26px 32px', display: 'flex', flexWrap: 'wrap', gap: 32 }}>
        <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div className="sect" style={{ alignItems: 'baseline' }}>
            <span className="eyebrow">{isNumeric ? 'Progress' : 'Objectives'}</span>
            <span className="tab muted" style={{ fontSize: 14 }}>
              {prog.label}
            </span>
          </div>
          <Bar pct={prog.pct} kind="xp" label="Plan progress" />
          {isNumeric && (
            <p className="help">
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
          {prog.objectives.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
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
            <p className="muted" style={{ fontSize: 14 }}>
              {inst ? `${inst.name} has no wings or bosses listed, so this completes when you mark it cleared.` : 'No objectives. Mark it complete when it’s done.'}
            </p>
          )}
          {inst && plan.status === 'active' && (
            <button type="button" className="btn2 sm" style={{ alignSelf: 'flex-start' }} onClick={() => open({ kind: 'instanceProgress', instanceId: inst.id, characterId: owner?.id })}>
              Mark {inst.kind} progress
            </button>
          )}
        </div>

        <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <span className="eyebrow">Rewards</span>
          {(plan.reward || plan.type === 'item') && (
            <div className="soft" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12 }}>
              <span
                className="reward-slot"
                aria-hidden="true"
                style={{
                  boxShadow: `inset 0 0 0 1.5px ${QUALITY_COLOR[plan.rewardQuality ?? 'epic']}, 0 0 16px -4px ${QUALITY_COLOR[plan.rewardQuality ?? 'epic']}`,
                }}
              />
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: QUALITY_COLOR[plan.rewardQuality ?? 'epic'] }}>[{plan.reward ?? plan.target.item}]</span>
                <span className="help">{plan.rewardQuality ? plan.rewardQuality[0].toUpperCase() + plan.rewardQuality.slice(1) : 'Your reward'}</span>
              </span>
            </div>
          )}
          <div className="soft" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12 }}>
            <span className="reward-slot" aria-hidden="true" style={{ boxShadow: 'inset 0 0 0 1.5px #c9a45c', background: 'radial-gradient(circle at 50% 30%, #3a2a16, #15100e)' }}>
              <Icon.scroll size={22} color="#c9a45c" />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600 }}>A journal entry</span>
              <span className="help">Prompted when you complete it</span>
            </span>
          </div>
          {inst && (
            <>
              <span className="eyebrow" style={{ marginTop: 8 }}>
                Linked
              </span>
              <Link to={`/instances?i=${inst.id}`} style={{ fontWeight: 600, textDecoration: 'none' }}>
                {inst.name} · {levelRange(inst)} →
              </Link>
            </>
          )}
        </div>
      </div>

      <div style={{ padding: '18px 32px', borderTop: '1px solid rgba(233,200,150,.08)', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
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
    </article>
  );
}

import { Link } from 'react-router';
import { Bar } from './ui';
import { useOverlay } from './overlay';
import { createPlan } from '../db/actions';
import { LEVEL_UNLOCKS } from '../lib/guides';
import { formatMoney } from '../lib/logic';
import { savingsPlan } from '../lib/planTemplates';
import type { Character, WarPlan } from '../lib/types';

/** Upcoming gold costs (riding, dual spec…) against what the character has on hand. */
export function GoldGoals({ c, plans }: { c: Character; plans: WarPlan[] }) {
  const { toast, celebrate } = useOverlay();
  const goals = LEVEL_UNLOCKS.filter((u) => u.copper && u.level >= c.level);
  if (!goals.length) return null;
  const activeTitles = new Set(plans.filter((p) => p.status === 'active' && p.ownerId === c.id).map((p) => p.title));
  const short = (n: number) => formatMoney(n, { short: true });

  return (
    <ul className="gold-goals">
      {goals.map((u) => {
        const cost = u.copper!;
        const missing = Math.max(0, cost - c.copper);
        const plan = savingsPlan(c, u.id)!;
        return (
          <li key={u.id}>
            <div className="barlabel">
              <span>
                {u.title} · level {u.level}
              </span>
              <span className="tab">
                {short(c.copper)} / {short(cost)}
              </span>
            </div>
            <Bar pct={Math.min(1, c.copper / cost)} kind="progress" label={`${u.title}: ${short(c.copper)} of ${short(cost)}`} />
            <div className="row-gap" style={{ justifyContent: 'space-between', width: '100%' }}>
              <span className="help">{missing ? `${short(missing)} to go` : 'You can afford it'}</span>
              {activeTitles.has(plan.title) ? (
                <Link to="/plans" className="help">
                  Tracked in War Plans
                </Link>
              ) : (
                <button
                  type="button"
                  className="linkbtn"
                  onClick={async () => {
                    const { completed } = await createPlan(plan);
                    toast(`New war plan: ${plan.title}`);
                    celebrate(completed);
                  }}
                >
                  + Make it a plan
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

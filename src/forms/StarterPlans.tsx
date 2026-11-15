import { useState } from 'react';
import { Link } from 'react-router';
import { Modal, type ModalProps } from '../components/Modal';
import { Field } from '../components/ui';
import { PlanIcon } from '../components/icons';
import { useOverlay } from '../components/overlay';
import { createPlan } from '../db/actions';
import { usePlanContext, usePlans } from '../db/hooks';
import { fullName, todayISO } from '../lib/logic';
import { templatesFor } from '../lib/planTemplates';

/** Ready-made plans for one character, one click each. */
export function StarterPlans({ ownerId, onClose }: ModalProps & { ownerId?: string }) {
  const { toast, celebrate, open } = useOverlay();
  const ctx = usePlanContext();
  const plans = usePlans();
  const [picked, setPicked] = useState(ownerId);
  const [busy, setBusy] = useState<string | null>(null);
  if (!ctx || !plans) return null;

  const active = ctx.characters.filter((c) => c.status === 'active');
  const c = active.find((x) => x.id === picked) ?? active.find((x) => x.isMain) ?? active[0];
  const activeTitles = plans.filter((p) => p.status === 'active' && p.ownerId === c?.id).map((p) => p.title);
  const list = c ? templatesFor(c, { ...ctx, today: todayISO() }, activeTitles) : [];

  return (
    <Modal
      title="Starter plans"
      eyebrow="War Plans"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn2 quiet" onClick={() => open({ kind: 'plan', preset: { ownerId: c?.id } })}>
            Make my own instead
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <div className="mb">
        {!c ? (
          <p>Add a character first, then come back for plans that fit them.</p>
        ) : (
          <>
            <p className="help">
              Ready-made goals that fit {c.firstName}’s level. Add any you like; they show up in War Plans and tick themselves
              off as you log progress.
            </p>
            {active.length > 1 && (
              <Field label="For" htmlFor="sp-owner">
                <select id="sp-owner" className="inp" value={c.id} onChange={(e) => setPicked(e.target.value)}>
                  {active.map((x) => (
                    <option key={x.id} value={x.id}>
                      {fullName(x)} · level {x.level}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <ul className="starter-list">
              {list.map(({ template, plan, exists }) => (
                <li key={template.id} className="starter">
                  <span className="slot" aria-hidden="true">
                    <PlanIcon type={plan.type} size={22} />
                  </span>
                  <span className="starter-body">
                    <span className="starter-title">{plan.title}</span>
                    <span className="help">{template.blurb}</span>
                  </span>
                  {exists ? (
                    <Link to="/plans" className="help" onClick={onClose}>
                      Added
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="btn2 sm"
                      aria-label={`Add ${plan.title}`}
                      disabled={busy === template.id}
                      onClick={async () => {
                        setBusy(template.id);
                        try {
                          const { completed } = await createPlan(plan);
                          toast(`New war plan: ${plan.title}`);
                          celebrate(completed);
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      + Add
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}

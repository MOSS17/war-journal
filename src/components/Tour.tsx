// A five-step walk through the app, pointing at the nav. It runs once on the War Board after the
// first character exists (remembered in meta.tourSeen, so it follows the account across devices),
// and again from the footer's "Take the tour" link (/?tour=1).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { setMeta } from '../db/actions';
import { useCharacters, useMeta } from '../db/hooks';

const STEPS: { to: string; title: string; body: string }[] = [
  {
    to: '/',
    title: 'Your War Board',
    body: 'Home base: your main character, what comes next at their level, the plans you track and a to-do list for tonight.',
  },
  {
    to: '/plans',
    title: 'War Plans',
    body: 'Goals you set yourself: a dungeon, a level, a profession skill or gold for your mount. Not sure what to aim for? Pick a starter plan.',
  },
  {
    to: '/instances',
    title: 'Instances',
    body: 'Every dungeon and raid: which fit your level, how to get there as Horde, and the quests to pick up before you go.',
  },
  {
    to: '/journal',
    title: 'Journal and Library',
    body: 'Write down first kills, deaths and funny moments. Save the guides and notes you keep looking up in the Library.',
  },
  {
    to: '/guide',
    title: 'Field Guide',
    body: 'New to the game? Short answers about classes, professions and where to quest, with links to the full guides.',
  },
];

const KEY = 'tourSeen';
const GAP = 12;
const WIDTH = 340;

export function Tour() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const characters = useCharacters();
  const seen = useMeta<boolean>(KEY, false);
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const replay = params.get('tour') === '1';
  const active =
    !dismissed &&
    loc.pathname === '/' &&
    (replay || (seen === false && !!characters && characters.some((c) => c.status === 'active')));
  const s = STEPS[step];

  const finish = useCallback(() => {
    setDismissed(true);
    setStep(0);
    if (!seen) void setMeta(KEY, true);
    if (replay) navigate('/', { replace: true });
  }, [seen, replay, navigate]);

  // A replay link clicked again starts over.
  useEffect(() => {
    if (replay) {
      setDismissed(false);
      setStep(0);
    }
  }, [replay]);

  useEffect(() => {
    if (active) window.scrollTo({ top: 0 });
  }, [active]);

  // Point at the step's nav item, or sit in the middle when the nav is folded away (phones).
  useLayoutEffect(() => {
    if (!active) return;
    const target = document.querySelector<HTMLElement>(`#main-nav [data-tour="${s.to}"]`);
    const place = () => {
      const r = target?.getBoundingClientRect();
      if (!r || r.width === 0 || r.height === 0 || !target?.offsetParent) return setPos(null);
      const left = Math.max(16, Math.min(r.left + r.width / 2 - WIDTH / 2, window.innerWidth - WIDTH - 16));
      setPos({ top: r.bottom + GAP, left });
    };
    target?.classList.add('tour-target');
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true });
    panel.current?.focus();
    return () => {
      target?.classList.remove('tour-target');
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place);
    };
  }, [active, s.to]);

  if (!active) return null;
  const last = step === STEPS.length - 1;

  return (
    <div
      ref={panel}
      className={`tip tour${pos ? '' : ' centered'}`}
      role="dialog"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
      tabIndex={-1}
      style={pos ? { top: pos.top, left: pos.left, width: WIDTH } : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Escape') finish();
      }}
    >
      {pos && <span className="tour-arrow" aria-hidden="true" />}
      <span className="eyebrow">
        {step + 1} of {STEPS.length}
      </span>
      <h2 id="tour-title">{s.title}</h2>
      <p id="tour-body">{s.body}</p>
      <div className="row-gap" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="linkbtn" onClick={finish}>
          Skip tour
        </button>
        <div className="row-gap">
          {step > 0 && (
            <button type="button" className="btn2 sm" onClick={() => setStep((n) => Math.max(0, n - 1))}>
              Back
            </button>
          )}
          <button type="button" className="btn sm" onClick={() => (last ? finish() : setStep((n) => Math.min(STEPS.length - 1, n + 1)))}>
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

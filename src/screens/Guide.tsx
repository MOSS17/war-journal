import { useSearchParams } from 'react-router';
import { Page } from '../components/Shell';
import { Frame, Segmented } from '../components/ui';
import { ClassGlyph } from '../components/icons';
import { GuideLinks } from '../components/GuideLinks';
import { useCharacters } from '../db/hooks';
import { CLASSES, PRIMARY_PROFESSIONS, SECONDARY_PROFESSIONS } from '../lib/gamedata';
import {
  CLASS_GUIDES,
  CLASS_GUIDE_INDEX,
  GUIDE_DISCLAIMER,
  LEVELING_GUIDE,
  PROFESSION_GUIDES,
  PROFESSION_GUIDE_INDEX,
  PROFESSION_KIND_LABEL,
  PROFESSION_TIP,
  ZONE_GUIDES,
  bracketLabel,
  zoneBracket,
  type ProfessionGuideKind,
} from '../lib/guides';
import { fullName } from '../lib/logic';
import type { Character, ClassName } from '../lib/types';

type Tab = 'classes' | 'professions' | 'zones';
const TABS: { value: Tab; label: string }[] = [
  { value: 'classes', label: 'Classes' },
  { value: 'professions', label: 'Professions' },
  { value: 'zones', label: 'Zones' },
];

function ClassesTab({ characters }: { characters: Character[] }) {
  const byClass = new Map<ClassName, Character[]>();
  for (const c of characters) byClass.set(c.class, [...(byClass.get(c.class) ?? []), c]);
  return (
    <>
      <div className="grid-auto">
        {CLASSES.map((cls) => {
          const g = CLASS_GUIDES[cls];
          const mine = byClass.get(cls);
          return (
            <Frame key={cls} title={cls} as="article">
              <div className="row-gap">
                <ClassGlyph cls={cls} size={38} />
                {g.roles.map((r) => (
                  <span key={r} className="pill sm">
                    {r}
                  </span>
                ))}
              </div>
              <p>{g.oneLiner}</p>
              <p className="muted">Good if {g.goodIf}</p>
              {mine && <p className="help">You play: {mine.map(fullName).join(', ')}</p>}
              <GuideLinks links={g.links} category="Class" />
            </Frame>
          );
        })}
      </div>
      <GuideLinks links={[CLASS_GUIDE_INDEX]} category="Class" />
    </>
  );
}

function ProfessionsTab() {
  const names = [...PRIMARY_PROFESSIONS, ...SECONDARY_PROFESSIONS];
  const kinds: ProfessionGuideKind[] = ['gathering', 'crafting', 'secondary'];
  return (
    <>
      <p className="notice">{PROFESSION_TIP}</p>
      <div className="grid-auto">
        {kinds.map((k) => (
          <Frame key={k} title={PROFESSION_KIND_LABEL[k]}>
            {names
              .filter((n) => PROFESSION_GUIDES[n]?.kind === k)
              .map((n) => {
                const g = PROFESSION_GUIDES[n];
                return (
                  <div key={n} className="guide-item">
                    <h3>{n}</h3>
                    <p>{g.oneLiner}</p>
                    {g.pairsWith.length > 0 && <p className="help">Pairs with: {g.pairsWith.join(', ')}</p>}
                    <GuideLinks links={g.links} category="Professions" />
                  </div>
                );
              })}
          </Frame>
        ))}
      </div>
      <GuideLinks links={[PROFESSION_GUIDE_INDEX]} category="Professions" />
    </>
  );
}

function ZonesTab({ main }: { main?: Character }) {
  const brackets = [...new Set(ZONE_GUIDES.map((z) => zoneBracket(z.minLevel)))];
  const here = main ? zoneBracket(main.level) : null;
  return (
    <>
      <p className="notice">
        Levels are where questing starts to make sense. You can go earlier with a group, or stay later to finish a
        story. Alliance-held zones are left out.
      </p>
      <div className="grid-auto">
        {brackets.map((b) => (
          <Frame
            key={b}
            title={bracketLabel(b)}
            right={here === b && main ? <span className="pill main">{main.firstName} is here</span> : undefined}
          >
            {ZONE_GUIDES.filter((z) => zoneBracket(z.minLevel) === b).map((z) => (
              <div key={z.id} className="guide-item">
                <div className="row-gap">
                  <h3>{z.name}</h3>
                  <span className="help">From level {z.minLevel}</span>
                  {z.territory === 'horde' && <span className="pill sm horde">Horde</span>}
                  {z.territory === 'contested' && <span className="pill sm">Contested</span>}
                  {z.isNewInForever && <span className="pill sm new">New in Forever</span>}
                </div>
                {(z.note || z.continent) && <p className="help">{[z.continent, z.note].filter(Boolean).join(' · ')}</p>}
                <GuideLinks links={z.links} category="Wiki" />
              </div>
            ))}
          </Frame>
        ))}
      </div>
      <GuideLinks links={[LEVELING_GUIDE]} category="Wiki" />
    </>
  );
}

export function Guide() {
  const [params, setParams] = useSearchParams();
  const characters = useCharacters();
  const tab = (TABS.find((t) => t.value === params.get('tab'))?.value ?? 'classes') as Tab;
  const active = characters?.filter((c) => c.status === 'active') ?? [];
  const main = active.find((c) => c.isMain) ?? active[0];

  return (
    <Page variant="library" title="Field Guide" eyebrow="Short answers for new players, with links to the full guides">
      <div className="stack">
        <Segmented
          label="Guide section"
          value={tab}
          options={TABS}
          onChange={(v) => {
            const next = new URLSearchParams(params);
            next.set('tab', v);
            setParams(next, { replace: true });
          }}
        />
        {tab === 'classes' && <ClassesTab characters={active} />}
        {tab === 'professions' && <ProfessionsTab />}
        {tab === 'zones' && <ZonesTab main={main} />}
        <p className="help">{GUIDE_DISCLAIMER}</p>
      </div>
    </Page>
  );
}

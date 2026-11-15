/** "What's next" for a character: upcoming trainer visits, unlocks, dungeons and where to quest. */
import { MAX_LEVEL } from './gamedata';
import { LEVEL_UNLOCKS, START_ZONE, ZONE_GUIDES, type ZoneGuide } from './guides';
import { isLocked } from './logic';
import type { Character, GuideLink, ISODate, Instance, InstanceProgress } from './types';

export interface Milestone {
  id: string;
  level: number;
  kind: 'trainer' | 'unlock' | 'dungeon';
  title: string;
  detail: string;
  copper?: number;
  instanceId?: string;
  links: GuideLink[];
}

/** How far ahead to look for dungeons coming into range. */
const DUNGEON_WINDOW = 5;

export function upcomingMilestones(
  c: Pick<Character, 'id' | 'level'>,
  instances: Instance[],
  progress: InstanceProgress[],
  today: ISODate,
  limit = 4,
): Milestone[] {
  const out: Milestone[] = [];

  if (c.level < MAX_LEVEL) {
    const next = c.level % 2 === 0 ? c.level + 2 : c.level + 1;
    out.push({
      id: `trainer-${next}`,
      level: Math.min(next, MAX_LEVEL),
      kind: 'trainer',
      title: 'Visit your class trainer',
      detail: 'New spells and ranks come every even level. Train them in any capital city or starting town.',
      links: [],
    });
  }

  let legacyShown = false;
  for (const u of LEVEL_UNLOCKS) {
    if (!(u.when === 'reach' ? u.level > c.level : u.level >= c.level)) continue;
    // Legacy points repeat at 25/40/60: only the next one matters.
    if (u.id.startsWith('legacy-')) {
      if (legacyShown) continue;
      legacyShown = true;
    }
    out.push({ id: u.id, level: u.level, kind: 'unlock', title: u.title, detail: u.detail, copper: u.copper, links: u.links });
  }

  const cleared = new Set(progress.filter((p) => p.characterId === c.id && p.status === 'cleared').map((p) => p.instanceId));
  const ahead = instances
    // Alliance-side dungeons are possible but mean a trek through enemy land: leave them to the Instances screen.
    .filter(
      (i) =>
        i.kind === 'dungeon' &&
        i.territory !== 'alliance' &&
        i.levelMin > c.level &&
        !cleared.has(i.id) &&
        !isLocked(i, today),
    )
    .sort((a, b) => a.levelMin - b.levelMin || a.name.localeCompare(b.name));
  const soon = ahead.filter((i) => i.levelMin <= c.level + DUNGEON_WINDOW);
  for (const i of soon.length ? soon : ahead.slice(0, 1)) {
    out.push({
      id: `dungeon-${i.id}`,
      level: i.levelMin,
      kind: 'dungeon',
      title: i.name,
      detail: `Dungeon for levels ${i.levelMin}–${i.levelMax} in ${i.zone}.`,
      instanceId: i.id,
      links: i.guideLinks,
    });
  }

  const order = { trainer: 0, unlock: 1, dungeon: 2 };
  return out.sort((a, b) => a.level - b.level || order[a.kind] - order[b.kind]).slice(0, limit);
}

/**
 * Where to quest now: the race's start zone below level 10, otherwise the zones that opened
 * most recently (minimum level within the last 10 levels), newest first.
 */
export function zonesForLevel(c: Pick<Character, 'level' | 'race'>, limit = 3): ZoneGuide[] {
  if (c.level < 10) {
    const home = ZONE_GUIDES.find((z) => z.id === START_ZONE[c.race]);
    if (home) return [home];
  }
  return ZONE_GUIDES.filter((z) => z.minLevel >= 10 && z.minLevel <= c.level && z.minLevel > c.level - 10)
    .sort((a, b) => b.minLevel - a.minLevel)
    .slice(0, limit);
}

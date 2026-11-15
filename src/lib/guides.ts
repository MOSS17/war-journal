/**
 * Field Guide content for new players.
 *
 * Link out only: WoW Forever launched on 2026-11-04 and guide sites still disagree,
 * so this file keeps short, stable facts (names, roles, one-line explanations,
 * minimum zone levels) and points to a guide for everything else.
 * When you re-check a link, update its `checkedOn`.
 */
import type { ClassName, GuideLink, ISODate, Race, Territory } from './types';

export interface FieldLink extends GuideLink {
  /** When someone last opened the page and checked it still says what we claim. */
  checkedOn: ISODate;
}

const CHECKED: ISODate = '2026-11-14';
const TAVERN = 'https://www.warcrafttavern.com/forever/guides';
const WIKI = 'https://warcraft.wiki.gg/wiki';

const tavern = (slug: string, title: string): FieldLink => ({ title, url: `${TAVERN}/${slug}/`, checkedOn: CHECKED });
const wiki = (page: string, title: string): FieldLink => ({ title, url: `${WIKI}/${page}`, checkedOn: CHECKED });

/** Shown under every guide list. */
export const GUIDE_DISCLAIMER = 'WoW Forever is new and guides still change. Check the linked page before you spend gold.';

// ---------- Classes ----------

export type Role = 'Tank' | 'Healer' | 'Damage';

export interface ClassGuide {
  roles: Role[];
  oneLiner: string;
  /** Who tends to enjoy it. */
  goodIf: string;
  links: FieldLink[];
}

const classLinks = (slug: string, name: string) => [
  tavern(slug, `${name} guide`),
  tavern(`${slug}-leveling`, `${name} leveling guide`),
];

export const CLASS_GUIDES: Record<ClassName, ClassGuide> = {
  Warrior: {
    roles: ['Tank', 'Damage'],
    oneLiner: 'Heavy armour and big weapons. Builds rage by hitting and getting hit.',
    goodIf: "you like being in the thick of the fight and don't mind eating and resting between pulls.",
    links: classLinks('warrior', 'Warrior'),
  },
  Hunter: {
    roles: ['Damage'],
    oneLiner: 'Fights from range with a bow or gun, with a tamed pet to hold enemies off.',
    goodIf: 'you want an easy, safe class for solo questing with a companion.',
    links: classLinks('hunter', 'Hunter'),
  },
  Rogue: {
    roles: ['Damage'],
    oneLiner: 'Stealthy melee fighter who opens from the shadows and finishes with combo points.',
    goodIf: 'you like sneaking past fights, picking your moment and dealing heavy burst damage.',
    links: classLinks('rogue', 'Rogue'),
  },
  Priest: {
    roles: ['Healer', 'Damage'],
    oneLiner: 'Holy or Shadow magic. One of the strongest healers, or a damage caster with Shadow.',
    goodIf: 'you want to heal groups, or like a caster who can patch themselves up.',
    links: classLinks('priest', 'Priest'),
  },
  Shaman: {
    roles: ['Healer', 'Damage'],
    oneLiner: 'Drops totems that help the group, and can heal, cast lightning or fight in melee.',
    goodIf: 'you want a flexible class that is welcome in any group.',
    links: classLinks('shaman', 'Shaman'),
  },
  Mage: {
    roles: ['Damage'],
    oneLiner: 'Ranged caster with frost, fire and arcane. Conjures its own food and water.',
    goodIf: 'you like controlling fights from range and teleporting around the world.',
    links: classLinks('mage', 'Mage'),
  },
  Warlock: {
    roles: ['Damage'],
    oneLiner: 'Shadow caster with a summoned demon pet and damage-over-time spells.',
    goodIf: 'you like a pet class that drains enemies slowly and rarely needs to rest.',
    links: classLinks('warlock', 'Warlock'),
  },
  Druid: {
    roles: ['Tank', 'Healer', 'Damage'],
    oneLiner: 'Shapeshifter: bear to tank, cat for melee, caster to heal or cast nature spells.',
    goodIf: 'you want to try every role on one character.',
    links: classLinks('druid', 'Druid'),
  },
};

export const CLASS_GUIDE_INDEX = tavern('classes', 'All class guides');

// ---------- Professions ----------

export type ProfessionGuideKind = 'gathering' | 'crafting' | 'secondary';

export interface ProfessionGuide {
  kind: ProfessionGuideKind;
  oneLiner: string;
  /** Professions that use what this one makes or gathers (or feed it). */
  pairsWith: string[];
  links: FieldLink[];
}

const prof = (slug: string, name: string) => [tavern(slug, `${name} guide`)];

export const PROFESSION_GUIDES: Record<string, ProfessionGuide> = {
  Herbalism: {
    kind: 'gathering',
    oneLiner: 'Pick herbs you spot while questing. Sells well, and feeds Alchemy.',
    pairsWith: ['Alchemy', 'Mining', 'Skinning'],
    links: prof('herbalism', 'Herbalism'),
  },
  Mining: {
    kind: 'gathering',
    oneLiner: 'Mine ore veins for metal and stone. Feeds Blacksmithing and Engineering.',
    pairsWith: ['Blacksmithing', 'Engineering', 'Herbalism', 'Skinning'],
    links: prof('mining', 'Mining'),
  },
  Skinning: {
    kind: 'gathering',
    oneLiner: 'Skin the beasts you kill for leather. Easy gold while you level.',
    pairsWith: ['Leatherworking', 'Herbalism', 'Mining'],
    links: prof('skinning', 'Skinning'),
  },
  Alchemy: {
    kind: 'crafting',
    oneLiner: 'Brew potions and elixirs from herbs.',
    pairsWith: ['Herbalism'],
    links: prof('alchemy', 'Alchemy'),
  },
  Blacksmithing: {
    kind: 'crafting',
    oneLiner: 'Forge mail and plate armour and weapons from metal bars.',
    pairsWith: ['Mining'],
    links: prof('blacksmithing', 'Blacksmithing'),
  },
  Engineering: {
    kind: 'crafting',
    oneLiner: 'Build gadgets, bombs, scopes and gizmos. Fun, but rarely makes gold.',
    pairsWith: ['Mining'],
    links: prof('engineering', 'Engineering'),
  },
  Leatherworking: {
    kind: 'crafting',
    oneLiner: 'Make leather and mail armour, and armour kits, from skins.',
    pairsWith: ['Skinning'],
    links: prof('leatherworking', 'Leatherworking'),
  },
  Tailoring: {
    kind: 'crafting',
    oneLiner: 'Sew cloth armour and bags from the cloth enemies drop. No gathering needed.',
    pairsWith: ['Enchanting'],
    links: prof('tailoring', 'Tailoring'),
  },
  Enchanting: {
    kind: 'crafting',
    oneLiner: 'Break unwanted magic items into dust and add permanent bonuses to gear.',
    pairsWith: ['Tailoring'],
    links: prof('enchanting', 'Enchanting'),
  },
  Cooking: {
    kind: 'secondary',
    oneLiner: 'Cook food that heals and gives buffs. Doesn’t count toward your two professions.',
    pairsWith: ['Fishing'],
    links: prof('cooking', 'Cooking'),
  },
  'First Aid': {
    kind: 'secondary',
    oneLiner: 'Make bandages from cloth to heal yourself. Worth it for every class.',
    pairsWith: [],
    links: prof('first-aid', 'First Aid'),
  },
  Fishing: {
    kind: 'secondary',
    oneLiner: 'Catch fish for Cooking and the occasional treasure. Relaxing between quests.',
    pairsWith: ['Cooking'],
    links: prof('fishing', 'Fishing'),
  },
};

export const PROFESSION_KIND_LABEL: Record<ProfessionGuideKind, string> = {
  gathering: 'Gathering',
  crafting: 'Crafting',
  secondary: 'Secondary (learn all three)',
};

export const PROFESSION_TIP =
  'You can learn two main professions. A common start is two gathering professions for gold while you level, or one gathering profession plus the crafting profession it feeds.';

export const PROFESSION_GUIDE_INDEX = tavern('professions', 'All profession guides');

// ---------- Zones ----------

export type Continent = 'Kalimdor' | 'Eastern Kingdoms';

export interface ZoneGuide {
  id: string;
  name: string;
  /** Minimum recommended questing level, from the Warcraft Tavern leveling overview. */
  minLevel: number;
  /** From a Horde player's point of view. Unset for new zones until sources agree. */
  territory?: Territory;
  continent?: Continent;
  isNewInForever?: boolean;
  note?: string;
  links: FieldLink[];
}

export const LEVELING_GUIDE = tavern('leveling', 'Leveling overview');

const zone = (
  name: string,
  minLevel: number,
  territory: Territory,
  continent: Continent,
  note?: string,
): ZoneGuide => ({
  id: name.toLowerCase().replace(/[^a-z]+/g, '-'),
  name,
  minLevel,
  territory,
  continent,
  note,
  links: [wiki(name.replace(/ /g, '_'), `${name} on the wiki`)],
});

const newZone = (name: string, minLevel: number, note?: string, continent?: Continent): ZoneGuide => ({
  id: name.toLowerCase().replace(/[^a-z]+/g, '-'),
  name,
  minLevel,
  continent,
  isNewInForever: true,
  note,
  links: [LEVELING_GUIDE],
});

/**
 * Questing zones a Horde player can level in, by minimum level. Zones held by the Alliance
 * (Elwynn, Westfall, Duskwood…) are left out.
 */
export const ZONE_GUIDES: ZoneGuide[] = [
  zone('Durotar', 1, 'horde', 'Kalimdor', 'Orc and Troll start'),
  zone('Mulgore', 1, 'horde', 'Kalimdor', 'Tauren start'),
  zone('Tirisfal Glades', 1, 'horde', 'Eastern Kingdoms', 'Undead start'),
  newZone('Zephras Isle', 1, 'Skyborne start'),
  zone('The Barrens', 10, 'horde', 'Kalimdor'),
  zone('Silverpine Forest', 10, 'horde', 'Eastern Kingdoms'),
  zone('Stonetalon Mountains', 15, 'contested', 'Kalimdor'),
  zone('Ashenvale', 18, 'contested', 'Kalimdor'),
  zone('Hillsbrad Foothills', 20, 'contested', 'Eastern Kingdoms'),
  zone('Thousand Needles', 25, 'contested', 'Kalimdor'),
  zone('Alterac Mountains', 30, 'contested', 'Eastern Kingdoms'),
  zone('Arathi Highlands', 30, 'contested', 'Eastern Kingdoms'),
  zone('Desolace', 30, 'contested', 'Kalimdor'),
  zone('Stranglethorn Vale', 30, 'contested', 'Eastern Kingdoms'),
  zone('Badlands', 35, 'contested', 'Eastern Kingdoms'),
  zone('Dustwallow Marsh', 35, 'contested', 'Kalimdor'),
  zone('Feralas', 35, 'contested', 'Kalimdor'),
  newZone('Riverglades', 35),
  zone('Swamp of Sorrows', 35, 'contested', 'Eastern Kingdoms'),
  newZone("Shen'dralas", 40),
  zone('Tanaris', 40, 'contested', 'Kalimdor'),
  zone('The Hinterlands', 40, 'contested', 'Eastern Kingdoms'),
  zone('Searing Gorge', 43, 'contested', 'Eastern Kingdoms'),
  zone('Azshara', 45, 'contested', 'Kalimdor'),
  zone('Blasted Lands', 45, 'contested', 'Eastern Kingdoms'),
  zone('Felwood', 45, 'contested', 'Kalimdor'),
  zone("Un'Goro Crater", 48, 'contested', 'Kalimdor'),
  zone('Burning Steppes', 50, 'contested', 'Eastern Kingdoms'),
  zone('Western Plaguelands', 50, 'contested', 'Eastern Kingdoms'),
  zone('Eastern Plaguelands', 53, 'contested', 'Eastern Kingdoms'),
  zone('Winterspring', 53, 'contested', 'Kalimdor'),
  zone('Deadwind Pass', 55, 'contested', 'Eastern Kingdoms'),
  zone('Silithus', 55, 'contested', 'Kalimdor'),
  newZone('Mount Hyjal', 60, 'Endgame zone, home of the Barrow Deeps and Hyjal Summit raids', 'Kalimdor'),
];

/** Level brackets for the Zones tab: 1–9, 10–19 … 50–60. */
export function zoneBracket(minLevel: number): number {
  return Math.min(50, Math.floor(minLevel / 10) * 10);
}

export function bracketLabel(start: number): string {
  return start === 0 ? 'Levels 1–9' : start === 50 ? 'Levels 50–60' : `Levels ${start}–${start + 9}`;
}

// ---------- Level unlocks (What's next, gold planner) ----------

export interface LevelUnlock {
  id: string;
  level: number;
  title: string;
  detail: string;
  /**
   * 'reach': happens when you hit the level (shown only before you get there).
   * 'learn': something you go and buy or train at that level (still shown at that level).
   */
  when: 'reach' | 'learn';
  /** Gold it takes, in copper, when a source states it. */
  copper?: number;
  links: FieldLink[];
}

const GOLD = 10000;
const FOREVER_WIKI = wiki('Forever', 'WoW Forever on the wiki');
export const RIDING_GUIDE = tavern('riding', 'Riding guide');

const legacy = (level: number): LevelUnlock => ({
  id: `legacy-${level}`,
  level,
  title: 'Legacy points',
  detail: 'Reaching 25, 40 and 60 on a class earns account-wide Legacy points to spend at your class trainer.',
  when: 'reach',
  links: [FOREVER_WIKI],
});

/** Sorted by level. Only facts a source states; costs before reputation discounts. */
export const LEVEL_UNLOCKS: LevelUnlock[] = [
  legacy(25),
  legacy(40),
  {
    id: 'riding',
    level: 40,
    title: 'Learn to ride',
    detail: 'Apprentice Riding is 100g at your race’s riding trainer, plus 20g for the mount. Honored with your home faction takes 10% off both.',
    when: 'learn',
    copper: 120 * GOLD,
    links: [RIDING_GUIDE],
  },
  {
    id: 'dual-spec',
    level: 40,
    title: 'Dual spec',
    detail: 'Your class trainer sells a second talent setup for 50g, so you can swap between, say, questing and dungeon talents.',
    when: 'learn',
    copper: 50 * GOLD,
    links: [FOREVER_WIKI],
  },
  legacy(60),
  {
    id: 'journeyman-riding',
    level: 60,
    title: 'Fast mount',
    detail: 'Journeyman Riding is 1,000g, plus 200g for the faster mount.',
    when: 'learn',
    copper: 1200 * GOLD,
    links: [RIDING_GUIDE],
  },
];

/** Where each race starts questing. */
export const START_ZONE: Record<Race, string> = {
  Orc: 'durotar',
  Troll: 'durotar',
  Tauren: 'mulgore',
  Undead: 'tirisfal-glades',
  Skyborne: 'zephras-isle',
};

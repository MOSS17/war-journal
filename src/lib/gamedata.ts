import type { ClassName, Quality, Race, Ruleset } from './types';

export const RACES: { name: Race; home?: string }[] = [
  { name: 'Orc', home: 'Durotar' },
  { name: 'Troll', home: 'Durotar' },
  { name: 'Tauren', home: 'Mulgore' },
  { name: 'Undead', home: 'Tirisfal Glades' },
  { name: 'Skyborne' },
];

export const CLASSES: ClassName[] = [
  'Warrior',
  'Hunter',
  'Rogue',
  'Priest',
  'Shaman',
  'Mage',
  'Warlock',
  'Druid',
];

export const CLASS_COLOR: Record<ClassName, string> = {
  Warrior: '#C69B6D',
  Hunter: '#AAD372',
  Rogue: '#FFF468',
  Priest: '#FFFFFF',
  Shaman: '#3B8FF0',
  Mage: '#3FC7EB',
  Warlock: '#8788EE',
  Druid: '#FF7C0A',
};

/** Which classes each Horde race can play. */
export const RACE_CLASSES: Record<Race, ClassName[]> = {
  Orc: ['Warrior', 'Hunter', 'Rogue', 'Shaman', 'Warlock'],
  Troll: ['Warrior', 'Hunter', 'Rogue', 'Priest', 'Shaman', 'Mage'],
  Tauren: ['Warrior', 'Hunter', 'Shaman', 'Druid'],
  Undead: ['Warrior', 'Rogue', 'Priest', 'Mage', 'Warlock'],
  Skyborne: ['Warrior', 'Hunter', 'Rogue', 'Druid', 'Shaman'],
};

export const RULESETS: Ruleset[] = ['PvP', 'PvE', 'RP', 'RP-PvP', 'Hardcore'];

export const PRIMARY_PROFESSIONS = [
  'Alchemy',
  'Blacksmithing',
  'Enchanting',
  'Engineering',
  'Herbalism',
  'Leatherworking',
  'Mining',
  'Skinning',
  'Tailoring',
];
export const SECONDARY_PROFESSIONS = ['Cooking', 'First Aid', 'Fishing'];
export const MAX_SKILL = 300;
export const MAX_LEVEL = 60;

export const LIBRARY_CATEGORIES = [
  'Class',
  'Professions',
  'Dungeons',
  'PvP',
  'Maps',
  'Addons',
  'UI',
  'Wiki',
  'Database',
  'News',
];

export const QUALITY_COLOR: Record<Quality, string> = {
  poor: '#9D9D9D',
  common: '#FFFFFF',
  uncommon: '#1EFF00',
  rare: '#0070DD',
  epic: '#A335EE',
  legendary: '#FF8000',
};
export const QUALITIES: Quality[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const JOURNAL_TAG_SUGGESTIONS = [
  'first kill',
  'death',
  'PvP',
  'funny',
  'milestone',
  'friendly stranger',
];

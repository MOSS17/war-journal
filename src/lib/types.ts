// Domain types for the War Journal. Every record that describes the game carries
// `source` and `updatedAt` so a later importer (Battle.net API or an addon) can
// fill or overwrite fields without a redesign.

export type Source = 'manual' | 'api' | 'addon';

export type Race = 'Orc' | 'Troll' | 'Tauren' | 'Undead' | 'Skyborne';
export type ClassName =
  | 'Warrior'
  | 'Hunter'
  | 'Rogue'
  | 'Priest'
  | 'Shaman'
  | 'Mage'
  | 'Warlock'
  | 'Druid';

export type Ruleset = 'PvP' | 'PvE' | 'RP' | 'RP-PvP' | 'Hardcore';

/** An ISO calendar date, YYYY-MM-DD, in the player's local time. */
export type ISODate = string;
/** An ISO timestamp. */
export type ISOTime = string;

export interface Character {
  id: string;
  firstName: string;
  lastName: string;
  race: Race;
  class: ClassName;
  level: number;
  /** Experience into the current level, 0–100. */
  xpPct: number;
  ruleset: Ruleset;
  faction: 'Horde';
  guild?: string;
  /** Money on hand, in copper (100c = 1s, 100s = 1g). */
  copper: number;
  playedMinutes?: number;
  isMain: boolean;
  status: 'active' | 'retired';
  source: Source;
  createdAt: ISOTime;
  updatedAt: ISOTime;
}

export type ProfessionKind = 'primary' | 'secondary';

export interface Profession {
  id: string;
  characterId: string;
  name: string;
  kind: ProfessionKind;
  /** 0–300 */
  skill: number;
  specialization?: string;
  source: Source;
  updatedAt: ISOTime;
}

export type InstanceKind = 'dungeon' | 'raid';
export type InstanceSize = 5 | 10 | 20 | 40;

export interface GuideLink {
  title: string;
  url: string;
}

/** Whose land the entrance sits in, from a Horde player's point of view. */
export type Territory = 'horde' | 'contested' | 'alliance';
export type QuestFaction = 'horde' | 'alliance' | 'both';
export type QuestKind = 'quest' | 'key' | 'attunement';

export interface InstanceQuest {
  /** Unique within its instance. */
  id: string;
  name: string;
  faction: QuestFaction;
  kind: QuestKind;
  giver: string;
  location: string;
  minLevel?: number;
  /** The quest (or chain) you must finish first. */
  prereq?: string;
  /** How to pick it up and what to do inside. */
  howTo: string;
  /** False when only unofficial sources mention it. */
  confirmed: boolean;
}

export interface Instance {
  id: string;
  name: string;
  kind: InstanceKind;
  size: InstanceSize;
  levelMin: number;
  levelMax: number;
  zone: string;
  continent?: string;
  isNewInForever: boolean;
  unlockDate?: ISODate;
  wings: string[];
  bosses: string[];
  guideLinks: GuideLink[];
  notes: string;
  territory: Territory;
  /** How a Horde character reaches the entrance. */
  hordeAccess: string;
  quests: InstanceQuest[];
  source: Source;
  updatedAt: ISOTime;
}

export type RunStatus = 'not-run' | 'run' | 'cleared';

export interface InstanceProgress {
  /** `${characterId}:${instanceId}` */
  id: string;
  characterId: string;
  instanceId: string;
  status: RunStatus;
  wingsCleared: string[];
  bossesKilled: string[];
  /** Ids of InstanceQuest rows this character has finished. */
  questsDone: string[];
  timesRun: number;
  firstClearDate?: ISODate;
  source: Source;
  updatedAt: ISOTime;
}

export type PlanType = 'dungeon' | 'raid' | 'level' | 'profession' | 'gold' | 'item' | 'custom';
export type PlanStatus = 'active' | 'done' | 'abandoned';
export type Quality = 'poor' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** 'account' means the plan belongs to the whole warband. */
export const ACCOUNT = 'account';

export interface PlanTarget {
  instanceId?: string;
  /** Raid plans with a boss are "kill raid boss"; without, "clear raid". */
  boss?: string;
  level?: number;
  profession?: string;
  skill?: number;
  item?: string;
  copper?: number;
}

export interface Objective {
  id: string;
  text: string;
  /**
   * Objectives linked to an instance wing or boss take their done state from
   * InstanceProgress. Free objectives store it here.
   */
  link?: { wing: string } | { boss: string };
  done: boolean;
  doneAt?: ISODate;
}

export interface WarPlan {
  id: string;
  title: string;
  type: PlanType;
  ownerId: string; // character id or ACCOUNT
  status: PlanStatus;
  tracked: boolean;
  target: PlanTarget;
  objectives: Objective[];
  /** Manual completion for item/custom plans without objectives. */
  manualDone?: boolean;
  dueDate?: ISODate;
  /** Recommended level, used for difficulty on non-instance plans. */
  level?: number;
  notes: string;
  reward?: string;
  rewardQuality?: Quality;
  createdAt: ISOTime;
  completedAt?: ISOTime;
  updatedAt: ISOTime;
}

export const JOURNAL_TAGS = ['first kill', 'death', 'PvP', 'funny', 'milestone'] as const;

export interface JournalEntry {
  id: string;
  date: ISODate;
  characterId?: string;
  /** The character's level when the entry was written. */
  level?: number;
  title: string;
  body: string;
  imageIds: string[];
  tags: string[];
  draft: boolean;
  createdAt: ISOTime;
  updatedAt: ISOTime;
}

export interface StoredImage {
  id: string;
  blob: Blob;
  type: string;
  createdAt: ISOTime;
}

export interface LibraryItem {
  id: string;
  kind: 'link' | 'note';
  title: string;
  url?: string;
  /** For a note, its text. For a link, "why I saved it". */
  body: string;
  category: string;
  tags: string[];
  pinned: boolean;
  instanceId?: string;
  planId?: string;
  createdAt: ISOTime;
  updatedAt: ISOTime;
}

export interface GameEvent {
  id: string;
  title: string;
  /** Exact date when announced. */
  date?: ISODate;
  /** Used to order undated events, e.g. the start of a season. */
  approxDate: ISODate;
  /** Shown instead of a date when there isn't one, e.g. "Winter 2026". */
  dateLabel?: string;
  detail?: string;
  kind: 'game-update' | 'personal';
  instanceIds: string[];
  source: Source;
  updatedAt: ISOTime;
}

export interface TonightTask {
  id: string;
  text: string;
  done: boolean;
  /** Local date the task was added. */
  date: ISODate;
  doneOn?: ISODate;
  createdAt: ISOTime;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

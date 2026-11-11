import { describe, expect, it } from 'vitest';
import {
  isUntouchedEvent,
  isUntouchedInstance,
  mergeEvents,
  mergeInstances,
  overridesFor,
  seedEventRows,
  seedInstanceRows,
} from './catalog';
import type { GameEvent, Instance } from './types';

const catalog = seedInstanceRows();
const rfc = catalog.find((i) => i.id === 'ragefire-chasm')!;
const events = seedEventRows();

const custom: Instance = { ...rfc, id: 'my-dungeon', name: 'My Dungeon', quests: [], territory: 'contested', hordeAccess: '' };

describe('mergeInstances', () => {
  it('shows the catalog as is when the player has no records', () => {
    expect(mergeInstances(catalog, [])).toEqual(catalog);
  });

  it("uses the player's edits but keeps the catalog's reference data", () => {
    const edited = { ...rfc, notes: 'Bring water', quests: [], territory: 'alliance' as const, hordeAccess: 'old' };
    const merged = mergeInstances(catalog, [edited]).find((i) => i.id === rfc.id)!;
    expect(merged.notes).toBe('Bring water');
    expect(merged.quests).toEqual(rfc.quests);
    expect(merged.territory).toBe(rfc.territory);
    expect(merged.hordeAccess).toBe(rfc.hordeAccess);
  });

  it('hides removed seeded instances and adds the player’s own', () => {
    const merged = mergeInstances(catalog, [{ id: rfc.id, hidden: true }, custom]);
    expect(merged.some((i) => i.id === rfc.id)).toBe(false);
    expect(merged.some((i) => i.id === 'my-dungeon')).toBe(true);
    expect(merged).toHaveLength(catalog.length);
  });
});

describe('mergeEvents', () => {
  it('applies edits and removals and adds personal events', () => {
    const [first, second] = events;
    const mine: GameEvent = { ...first, id: 'mine', title: 'Raid night', kind: 'personal' };
    const merged = mergeEvents(events, [{ ...first, title: 'Renamed' }, { id: second.id, hidden: true }, mine]);
    expect(merged.find((e) => e.id === first.id)!.title).toBe('Renamed');
    expect(merged.some((e) => e.id === second.id)).toBe(false);
    expect(merged.some((e) => e.id === 'mine')).toBe(true);
  });
});

describe('untouched seeded rows', () => {
  it('ignore timestamps, source and reference data', () => {
    expect(isUntouchedInstance({ ...rfc, updatedAt: '2026-01-01', quests: [], hordeAccess: 'x' }, rfc)).toBe(true);
    expect(isUntouchedEvent({ ...events[0], updatedAt: '2026-01-01' }, events[0])).toBe(true);
  });

  it('notice a rename, notes, bosses or links', () => {
    expect(isUntouchedInstance({ ...rfc, name: 'RFC' }, rfc)).toBe(false);
    expect(isUntouchedInstance({ ...rfc, notes: 'mine' }, rfc)).toBe(false);
    expect(isUntouchedInstance({ ...rfc, bosses: [...rfc.bosses, 'Extra'] }, rfc)).toBe(false);
    expect(isUntouchedInstance({ ...rfc, guideLinks: [{ title: 'Guide', url: 'https://example.com' }] }, rfc)).toBe(false);
  });

  it('treat text an older seed shipped as untouched', () => {
    const alcaz = catalog.find((i) => i.id === 'alcaz-island-prison');
    expect(isUntouchedInstance({ ...alcaz!, name: 'Alcaz Island Prison' }, alcaz!)).toBe(true);
  });
});

describe('overridesFor', () => {
  it('keeps edited and custom rows and drops untouched seeds', () => {
    const rows = [...catalog.filter((i) => i.id !== rfc.id), { ...rfc, notes: 'mine' }, custom];
    const out = overridesFor(rows, catalog, isUntouchedInstance, { hideMissing: true });
    expect(out.map((r) => r.id).sort()).toEqual(['my-dungeon', rfc.id].sort());
  });

  it('hides seeded rows that are missing only when asked', () => {
    const rows = catalog.filter((i) => i.id !== rfc.id);
    expect(overridesFor(rows, catalog, isUntouchedInstance, { hideMissing: true })).toEqual([{ id: rfc.id, hidden: true }]);
    expect(overridesFor(rows, catalog, isUntouchedInstance, { hideMissing: false })).toEqual([]);
  });
});

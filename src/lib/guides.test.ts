import { describe, expect, it } from 'vitest';
import { CLASSES, MAX_LEVEL, PRIMARY_PROFESSIONS, SECONDARY_PROFESSIONS } from './gamedata';
import { CLASS_GUIDES, PROFESSION_GUIDES, ZONE_GUIDES, bracketLabel, zoneBracket, type FieldLink } from './guides';

function expectLinks(links: FieldLink[]) {
  expect(links.length).toBeGreaterThan(0);
  for (const l of links) {
    expect(l.url).toMatch(/^https:\/\//);
    expect(l.title).not.toBe('');
    expect(l.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }
}

describe('Field Guide content', () => {
  it('covers every class', () => {
    for (const c of CLASSES) {
      const g = CLASS_GUIDES[c];
      expect(g.roles.length).toBeGreaterThan(0);
      expectLinks(g.links);
    }
  });

  it('covers every profession, and pairings name real professions', () => {
    const all = [...PRIMARY_PROFESSIONS, ...SECONDARY_PROFESSIONS];
    for (const p of all) {
      const g = PROFESSION_GUIDES[p];
      expect(g, p).toBeDefined();
      expectLinks(g.links);
      for (const other of g.pairsWith) expect(all).toContain(other);
    }
    for (const p of SECONDARY_PROFESSIONS) expect(PROFESSION_GUIDES[p].kind).toBe('secondary');
  });

  it('has valid, unique, sorted zones', () => {
    const ids = ZONE_GUIDES.map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const z of ZONE_GUIDES) {
      expect(z.minLevel).toBeGreaterThanOrEqual(1);
      expect(z.minLevel).toBeLessThanOrEqual(MAX_LEVEL);
      expectLinks(z.links);
      if (!z.isNewInForever) expect(z.territory).not.toBe('alliance');
    }
    const levels = ZONE_GUIDES.map((z) => z.minLevel);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it('groups levels into brackets', () => {
    expect(zoneBracket(1)).toBe(0);
    expect(zoneBracket(19)).toBe(10);
    expect(zoneBracket(60)).toBe(50);
    expect(bracketLabel(0)).toBe('Levels 1–9');
    expect(bracketLabel(50)).toBe('Levels 50–60');
  });
});

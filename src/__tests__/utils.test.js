import { describe, it, expect } from 'vitest';
import { fmt, clamp } from '../utils/format.js';
import { cpsFrom, clickMultiplierFrom } from '../utils/calc.js';
import { migrate, DEFAULT_STATE, createResetState } from '../utils/state.js';

describe('fmt', () => {
  it('formats large numbers with suffix', () => {
    expect(fmt(1500)).toBe('1,5K');
  });

  it('returns infinity symbol for non-finite numbers', () => {
    expect(fmt(Infinity)).toBe('∞');
  });
});

describe('clamp', () => {
  it('clamps values within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('cpsFrom', () => {
  it('computes cookies per second without upgrades', () => {
    const items = { oven: 1 };
    const upgrades = {};
    const cps = cpsFrom(items, upgrades, 0);
    expect(cps).toBeCloseTo(0.6);
  });
});

describe('clickMultiplierFrom', () => {
  it('applies softcap rationally as values grow', () => {
    const base = { cursor: 100, grandma: 50, farm: 20, factory: 10 };
    const low = clickMultiplierFrom({ cursor: 1 }, {});
    const high = clickMultiplierFrom(base, {});
    expect(low).toBeGreaterThan(1);
    expect(high).toBeGreaterThan(low);
    // softcap ensures growth < linear additive +1
    // upper bound sanity: should not explode beyond 100x for these values
    expect(high).toBeLessThan(50);
  });
});

describe('state.migrate', () => {
  it('fills missing fields and adds highContrast default', () => {
    const partial = { version: 3, cookies: 10, ui: { sounds: false } };
    const s = migrate(partial);
    expect(s.ui).toBeDefined();
    expect(s.ui.sounds).toBe(false);
    expect(s.ui.highContrast).toBe(false);
    expect(s.mission).toBeDefined();
    expect(typeof s.items).toBe('object');
  });

  it('handles null (creates default with mission)', () => {
    const s = migrate(null);
    expect(s.cookies).toBe(0);
    expect(s.mission).toBeDefined();
    expect(s.version).toBe(4);
  });
});

describe('state.createResetState', () => {
  it('preserves prestige and sounds when requested', () => {
    const s = createResetState(true, true, 7);
    expect(s.prestige.chips).toBe(7);
    expect(s.ui.sounds).toBe(true);
    expect(s.settings.soundEnabled).toBe(true);
  });
});

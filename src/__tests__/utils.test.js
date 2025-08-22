import { describe, it, expect } from 'vitest';
import { fmt, clamp } from '../utils/format.js';
import { cpsFrom } from '../utils/calc.js';

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
    const items = { cursor: 1 };
    const upgrades = {};
    const cps = cpsFrom(items, upgrades, 0);
    expect(cps).toBeCloseTo(0.22);
  });
});

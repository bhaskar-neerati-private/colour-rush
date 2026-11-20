import { describe, expect, it } from 'vitest';
import { BASE, cardPoint, invertScalar, parsePoint, parseScalar, randomInt, randomScalar, scalarToHex, shuffleInPlace } from '../../src/shuffle/group';
import { range } from './helpers';

describe('padlock basics', () => {
  it('locks can be added and removed in any order', () => {
    const card = cardPoint('g', 0, 7);
    const a = randomScalar();
    const b = randomScalar();
    const c = randomScalar();
    const locked = card.multiply(a).multiply(b).multiply(c);
    expect(card.multiply(c).multiply(a).multiply(b).equals(locked)).toBe(true);
    const opened = locked.multiply(invertScalar(b)).multiply(invertScalar(a)).multiply(invertScalar(c));
    expect(opened.equals(card)).toBe(true);
  });

  it('gives every card its own point, different in every game and every reshuffle', () => {
    const hexes = new Set(range(108).map((id) => cardPoint('g', 0, id).toHex()));
    expect(hexes.size).toBe(108);
    expect(cardPoint('g', 0, 5).equals(cardPoint('g', 0, 5))).toBe(true);
    expect(cardPoint('g', 0, 5).equals(cardPoint('g', 1, 5))).toBe(false);
    expect(cardPoint('g', 0, 5).equals(cardPoint('h', 0, 5))).toBe(false);
  });

  it('turns keys and points into text and back', () => {
    const k = randomScalar();
    expect(parseScalar(scalarToHex(k))).toBe(k);
    const p = BASE.multiply(k);
    expect(parsePoint(p.toHex())!.equals(p)).toBe(true);
  });

  it('refuses bad keys and points from other phones', () => {
    for (const bad of [undefined, 42, '', 'zz', '00'.repeat(32), 'f'.repeat(64), 'abc']) {
      expect(parseScalar(bad)).toBeNull();
    }
    for (const bad of [undefined, 42, '', '00'.repeat(32), 'ff'.repeat(32), 'xyz']) {
      expect(parsePoint(bad)).toBeNull();
    }
  });

  it('shuffles into a mix of the same items', () => {
    const items = range(52);
    const mixed = shuffleInPlace([...items]);
    expect([...mixed].sort((a, b) => a - b)).toEqual(items);
    expect(mixed).not.toEqual(items);
  });

  it('random whole numbers stay in range and reach every value', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const n = randomInt(6);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
      seen.add(n);
    }
    expect(seen.size).toBe(6);
  });
});

import { describe, expect, it } from 'vitest';
import { COLOURS, DECK, DECK_SIZE, canPlayOn, cardName, getCard, sortCardIds, type Card } from '../../src/rules/cards';
import { matches, nameOf } from './table';

const find = (name: string) => DECK.find((c) => matches(c, name))!;
const count = (pred: (c: Card) => boolean) => DECK.filter(pred).length;

describe('deck', () => {
  it('has 108 cards with ids 0 to 107', () => {
    expect(DECK).toHaveLength(DECK_SIZE);
    expect(DECK_SIZE).toBe(108);
    DECK.forEach((c, i) => expect(c.id).toBe(i));
  });

  it('has 25 cards per colour: one 0, two of 1 to 9, two Skip, two Reverse, two Draw 2', () => {
    for (const colour of COLOURS) {
      expect(count((c) => c.colour === colour)).toBe(25);
      expect(count((c) => c.colour === colour && c.value === '0')).toBe(1);
      for (let n = 1; n <= 9; n++) expect(count((c) => c.colour === colour && c.value === String(n))).toBe(2);
      for (const v of ['skip', 'reverse', 'draw2']) expect(count((c) => c.colour === colour && c.value === v)).toBe(2);
    }
  });

  it('has 4 Wild and 4 Wild Draw 4 cards without a colour', () => {
    expect(count((c) => c.colour === null && c.value === 'wild')).toBe(4);
    expect(count((c) => c.colour === null && c.value === 'wild4')).toBe(4);
    expect(count((c) => c.colour === null)).toBe(8);
  });

  it('refuses unknown card ids', () => {
    expect(() => getCard(108)).toThrow();
    expect(() => getCard(-1)).toThrow();
  });
});

describe('card names', () => {
  it('uses plain names with UK spelling', () => {
    expect(cardName(find('teal 7'))).toBe('Teal 7');
    expect(cardName(find('coral draw2'))).toBe('Coral Draw 2');
    expect(cardName(find('amber skip'))).toBe('Amber Skip');
    expect(cardName(find('violet reverse'))).toBe('Violet Reverse');
    expect(cardName(find('wild'))).toBe('Wild');
    expect(cardName(find('wild4'))).toBe('Wild Draw 4');
  });
});

describe('matching', () => {
  const teal5 = find('teal 5');

  it('matches by colour', () => {
    expect(canPlayOn(find('teal 2'), teal5, 'teal')).toBe(true);
    expect(canPlayOn(find('teal skip'), teal5, 'teal')).toBe(true);
  });

  it('matches by number', () => {
    expect(canPlayOn(find('coral 5'), teal5, 'teal')).toBe(true);
  });

  it('matches by symbol', () => {
    expect(canPlayOn(find('coral skip'), find('teal skip'), 'teal')).toBe(true);
    expect(canPlayOn(find('amber draw2'), find('violet draw2'), 'violet')).toBe(true);
  });

  it('refuses a card with another colour and another number', () => {
    expect(canPlayOn(find('coral 4'), teal5, 'teal')).toBe(false);
    expect(canPlayOn(find('amber reverse'), teal5, 'teal')).toBe(false);
  });

  it('lets Wild cards go on anything', () => {
    expect(canPlayOn(find('wild'), teal5, 'teal')).toBe(true);
    expect(canPlayOn(find('wild4'), teal5, 'teal')).toBe(true);
  });

  it('uses the picked colour after a Wild card', () => {
    const wild = find('wild');
    expect(canPlayOn(find('violet 3'), wild, 'violet')).toBe(true);
    expect(canPlayOn(find('teal 3'), wild, 'violet')).toBe(false);
  });
});

describe('hand order', () => {
  it('sorts by colour, then number and symbol, with Wild cards last', () => {
    const names = ['wild4', 'violet 2', 'teal skip', 'coral 9', 'wild', 'teal 1', 'amber draw2', 'coral 0'];
    const sorted = sortCardIds(names.map((n) => find(n).id)).map((id) => nameOf(getCard(id)));
    expect(sorted).toEqual(['coral 0', 'coral 9', 'amber draw2', 'teal 1', 'teal skip', 'violet 2', 'wild', 'wild4']);
  });
});

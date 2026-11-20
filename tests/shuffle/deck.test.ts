import { describe, expect, it } from 'vitest';
import { DeckRecord, KeySafe, auditDeck, checkPlayedCard, checkShare, openBox } from '../../src/shuffle/deck';
import { BASE, parsePoint, randomScalar, scalarToHex } from '../../src/shuffle/group';
import { allKeys, honestDeck, range, shuffleDeck } from './helpers';

const SMALL = range(20);

describe('shuffling a deck', () => {
  it.each([2, 3, 4, 5])('with %i players, every box opens to a different card, and all cards are there', (players) => {
    const { deck, safes } = honestDeck(players, SMALL);
    const opened = range(deck.size).map((pos) => openBox(deck, pos, allKeys(safes, 0, pos)));
    expect([...opened].sort((a, b) => a! - b!)).toEqual(SMALL);
    expect(opened).not.toEqual(SMALL); // mixed
  });

  it('works for a reshuffle deck with only some cards and a new epoch', () => {
    const ids = [3, 17, 40, 41, 99];
    const { deck, safes } = honestDeck(3, ids, 'test-game', 2);
    const opened = range(5).map((pos) => openBox(deck, pos, allKeys(safes, 2, pos)));
    expect([...opened].sort((a, b) => a! - b!)).toEqual(ids);
  });

  it('a player cannot open another player\'s card with the keys they are given', () => {
    const { deck, safes } = honestDeck(3, SMALL);
    const pos = 4;
    const keys = allKeys(safes, 0, pos);
    // Other players get every key except the owner's. With a guess instead of it, the box stays shut.
    const owner = 2;
    const guess = scalarToHex(randomScalar());
    const withoutOwner = keys.map((k, s) => (s === owner ? guess : k));
    expect(openBox(deck, pos, withoutOwner)).toBeNull();
    expect(openBox(deck, pos, keys.slice(0, 2))).toBeNull();
    expect(openBox(deck, pos, keys)).not.toBeNull();
  });

  it('checks each shared key against the promise made while shuffling', () => {
    const { deck, safes } = honestDeck(3, SMALL);
    expect(checkShare(deck, 1, 6, safes[1].share(0, 6))).toBe(true);
    expect(checkShare(deck, 1, 6, safes[0].share(0, 6))).toBe(false);
    expect(checkShare(deck, 1, 6, safes[1].share(0, 7))).toBe(false);
    expect(checkShare(deck, 1, 6, scalarToHex(randomScalar()))).toBe(false);
    expect(checkShare(deck, 1, 6, 'nonsense')).toBe(false);
  });

  it('catches a player who names the wrong card when playing', () => {
    const { deck, safes } = honestDeck(2, SMALL);
    const keys = allKeys(safes, 0, 3);
    const real = openBox(deck, 3, keys)!;
    expect(checkPlayedCard(deck, 3, keys, real)).toBe('ok');
    expect(checkPlayedCard(deck, 3, keys, (real + 1) % 20)).toBe('wrong card');
  });
});

describe('refusing bad shuffle messages', () => {
  it('refuses a step out of turn', () => {
    const deck = new DeckRecord('g', 0, SMALL, 3);
    const safes = range(3).map(() => new KeySafe());
    expect(deck.addLock(1, safes[1].lock(deck))).toMatch(/turn/);
    expect(deck.addRelock(0, [], [])).toMatch(/turn/);
  });

  it('refuses a list of the wrong length, a bad card, or a copied card', () => {
    const deck = new DeckRecord('g', 0, SMALL, 2);
    const safe = new KeySafe();
    const list = safe.lock(deck);
    expect(deck.addLock(0, list.slice(1))).toMatch(/wrong length/);
    expect(deck.addLock(0, [...list.slice(1), 'zz'])).toMatch(/not valid/);
    expect(deck.addLock(0, [list[1], ...list.slice(1)])).toMatch(/twice/);
    expect(deck.addLock(0, list)).toBeNull();
  });
});

describe('end-of-game check', () => {
  it('says "fair" for an honest game', () => {
    const { deck, safes } = honestDeck(4, SMALL);
    expect(auditDeck(deck, safes.map((s) => s.reveal(0)))).toEqual({ ok: true });
  });

  it('names a player who swapped in a different card while shuffling', () => {
    const deck = new DeckRecord('g', 0, SMALL, 3);
    const safes = range(3).map(() => new KeySafe());
    shuffleDeck(deck, safes, (step, sent) => {
      if (step.round === 1 && step.seat === 1) sent.points[0] = BASE.multiply(randomScalar()).toHex();
    });
    expect(auditDeck(deck, safes.map((s) => s.reveal(0)))).toEqual({ ok: false, seat: 1, reason: 'Their shuffle changed the cards.' });
  });

  it('names a player whose Round 2 padlocks do not match, and that box cannot be opened', () => {
    const deck = new DeckRecord('g', 0, SMALL, 3);
    const safes = range(3).map(() => new KeySafe());
    shuffleDeck(deck, safes, (step, sent) => {
      if (step.round === 2 && step.seat === 2) sent.points[5] = parsePoint(sent.points[5])!.multiply(randomScalar()).toHex();
    });
    expect(openBox(deck, 5, allKeys(safes, 0, 5))).toBeNull();
    expect(auditDeck(deck, safes.map((s) => s.reveal(0)))).toEqual({ ok: false, seat: 2, reason: 'Their padlocks did not match.' });
  });

  it('names a player whose key promise was false, and their shared key is refused', () => {
    const deck = new DeckRecord('g', 0, SMALL, 3);
    const safes = range(3).map(() => new KeySafe());
    shuffleDeck(deck, safes, (step, sent) => {
      if (step.round === 2 && step.seat === 0) sent.commits![3] = BASE.multiply(randomScalar()).toHex();
    });
    expect(checkShare(deck, 0, 3, safes[0].share(0, 3))).toBe(false);
    expect(auditDeck(deck, safes.map((s) => s.reveal(0)))).toEqual({ ok: false, seat: 0, reason: 'Their keys did not match their promise.' });
  });

  it('names a player who does not share their keys, or shares other keys', () => {
    const { deck, safes } = honestDeck(3, SMALL);
    const revealed = safes.map((s) => s.reveal(0));
    expect(auditDeck(deck, [revealed[0], undefined, revealed[2]])).toEqual({ ok: false, seat: 1, reason: 'They did not share their keys.' });
    const fake = { ...revealed[2], lockKey: scalarToHex(randomScalar()) };
    expect(auditDeck(deck, [revealed[0], revealed[1], fake])).toMatchObject({ ok: false, seat: 2 });
  });
});

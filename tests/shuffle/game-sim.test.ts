// Rules (phase 2) and padlocks (phase 3) together: whole games played by simulated players,
// where each player only ever opens their own cards and every played card is checked.

import { describe, expect, it } from 'vitest';
import { DECK_SIZE, canPlayOn, getCard, isWild } from '../../src/rules/cards';
import {
  apply, needsReshuffle, reshuffleCardIds, startGame, topCardId,
  type CardRef, type GameState, type Move, type Opening, type Result,
} from '../../src/rules/game';
import { DeckRecord, KeySafe, auditDeck, checkPlayedCard, checkShare, openBox } from '../../src/shuffle/deck';
import { BASE, randomScalar, scalarToHex } from '../../src/shuffle/group';
import { range, shuffleDeck } from './helpers';

const key = (r: CardRef) => `${r.epoch}:${r.pos}`;

function must(r: Result) {
  if (!r.ok) throw new Error(r.error);
  return r;
}

function playWholeGame(players: number) {
  const gameId = `sim-${players}`;
  const safes = range(players).map(() => new KeySafe());
  const decks = new Map<number, DeckRecord>();
  const newDeck = (epoch: number, ids: number[]) => {
    const deck = new DeckRecord(gameId, epoch, ids, players);
    shuffleDeck(deck, safes);
    decks.set(epoch, deck);
  };
  newDeck(0, range(DECK_SIZE));

  // What each player can see: their own cards, plus cards turned face up or played
  const known = range(players).map(() => new Map<string, number>());
  const keysFor = (r: CardRef) => safes.map((s) => s.share(r.epoch, r.pos));

  const handle = (open: Opening[]) => {
    for (const o of open) {
      const deck = decks.get(o.ref.epoch)!;
      const keys = keysFor(o.ref);
      keys.forEach((k, s) => expect(checkShare(deck, s, o.ref.pos, k)).toBe(true));
      const id = openBox(deck, o.ref.pos, keys);
      expect(id).not.toBeNull();
      if (o.to === 'all') known.forEach((m) => m.set(key(o.ref), id!));
      else known[o.to].set(key(o.ref), id!);
    }
  };

  let state: GameState;
  let r = must(startGame(players, 0));
  state = r.state;
  handle(r.open);

  // Without the owner's key, nobody else can open a dealt card
  for (const ref of state.hands[0]) {
    const keys = keysFor(ref).map((k, s) => (s === 0 ? scalarToHex(randomScalar()) : k));
    expect(openBox(decks.get(0)!, ref.pos, keys)).toBeNull();
  }

  while (state.phase === 'dealing') {
    r = must(apply(state, { type: 'flip', cardId: known[0].get(key(state.drawPile[0]))! }));
    state = r.state;
    handle(r.open);
  }

  const played = new Set<number>();
  let reshuffles = 0;
  for (let step = 0; step < 5000 && state.phase === 'playing'; step++) {
    if (needsReshuffle(state)) {
      const ids = reshuffleCardIds(state);
      newDeck(state.epoch + 1, ids);
      r = must(apply(state, { type: 'reshuffle', count: ids.length }));
      state = r.state;
      handle(r.open);
      reshuffles++;
      continue;
    }
    const seat = state.turn;
    const hand = state.hands[seat];
    const top = getCard(topCardId(state)!);
    const options = state.drawn ? [state.drawn] : hand;
    const choice = options.find((ref) => canPlayOn(getCard(known[seat].get(key(ref))!), top, state.colour!));

    if (choice) {
      if (hand.length === 2) state = must(apply(state, { type: 'lastCard', seat })).state;
      const cardId = known[seat].get(key(choice))!;
      // The other phones check the played card with the player's key and their own
      expect(checkPlayedCard(decks.get(choice.epoch)!, choice.pos, keysFor(choice), cardId)).toBe('ok');
      const move: Move = { type: 'play', seat, ref: choice, cardId, ...(isWild(getCard(cardId)) ? { colour: 'teal' as const } : {}) };
      r = must(apply(state, move));
      played.add(cardId);
    } else if (!state.drawn) {
      r = must(apply(state, { type: 'draw', seat }));
    } else {
      r = must(apply(state, { type: 'keep', seat }));
    }
    state = r.state;
    handle(r.open);
  }

  return { state, decks, safes, reshuffles, played };
}

describe('a whole game with padlocks', () => {
  it.each([2, 3])('%i players: someone wins, and the end-of-game check says fair', (players) => {
    const { state, decks, safes } = playWholeGame(players);
    expect(state.phase).toBe('over');
    expect(state.winner).not.toBeNull();
    for (const [epoch, deck] of decks) {
      expect(auditDeck(deck, safes.map((s) => s.reveal(epoch)))).toEqual({ ok: true });
    }
  }, 120_000);
});

describe('speed', () => {
  it('6 players shuffle, open and check all 108 cards', () => {
    const players = 6;
    const deck = new DeckRecord('speed', 0, range(DECK_SIZE), players);
    const safes = range(players).map(() => new KeySafe());

    let t = performance.now();
    shuffleDeck(deck, safes);
    const shuffleMs = performance.now() - t;

    t = performance.now();
    const opened = range(DECK_SIZE).map((pos) => openBox(deck, pos, safes.map((s) => s.share(0, pos))));
    const openMs = performance.now() - t;
    expect([...opened].sort((a, b) => a! - b!)).toEqual(range(DECK_SIZE));

    t = performance.now();
    expect(auditDeck(deck, safes.map((s) => s.reveal(0)))).toEqual({ ok: true });
    const auditMs = performance.now() - t;

    console.log(
      `6 players, 108 cards: shuffle ${Math.round(shuffleMs)} ms (about ${Math.round(shuffleMs / players)} ms per player), ` +
        `open all ${Math.round(openMs)} ms, end check ${Math.round(auditMs)} ms`,
    );
    expect(shuffleMs).toBeLessThan(20_000);
    expect(BASE).toBeDefined();
  }, 120_000);
});

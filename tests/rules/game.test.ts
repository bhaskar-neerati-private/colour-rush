import { describe, expect, it } from 'vitest';
import { DECK_SIZE } from '../../src/rules/cards';
import { HAND_SIZE, apply, canOnlyPass, needsReshuffle, startGame } from '../../src/rules/game';
import { Table } from './table';

describe('starting a game', () => {
  it('deals 7 cards to each of 2 to 6 players', () => {
    for (let n = 2; n <= 6; n++) {
      const r = startGame(n, 0);
      if (!r.ok) throw new Error(r.error);
      expect(r.state.hands.map((h) => h.length)).toEqual(Array(n).fill(HAND_SIZE));
      expect(r.state.drawPile).toHaveLength(DECK_SIZE - 7 * n);
    }
  });

  it('refuses 1 or 7 players and an unknown first player', () => {
    expect(startGame(1, 0).ok).toBe(false);
    expect(startGame(7, 0).ok).toBe(false);
    expect(startGame(3, 3).ok).toBe(false);
  });

  it('deals in play order from the first player, then asks to turn over the next card for everyone', () => {
    const r = startGame(3, 1);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.hands[1][0].pos).toBe(0);
    expect(r.state.hands[2][0].pos).toBe(7);
    expect(r.state.hands[0][0].pos).toBe(14);
    expect(r.open.filter((o) => o.to === 1)).toHaveLength(7);
    expect(r.open[r.open.length - 1]).toEqual({ ref: { epoch: 0, pos: 21 }, to: 'all' });
  });

  it('starts with the first player once a number card is turned over', () => {
    const t = new Table({ players: 3, first: 2 });
    expect(t.state.phase).toBe('playing');
    expect(t.top()).toBe('teal 5');
    expect(t.state.colour).toBe('teal');
    expect(t.state.turn).toBe(2);
  });

  it('keeps turning cards until a number card appears', () => {
    const t = new Table({ players: 2, flips: ['coral skip', 'wild', 'amber 3'] });
    expect(t.state.discard).toHaveLength(3);
    expect(t.top()).toBe('amber 3');
    expect(t.state.colour).toBe('amber');
    expect(t.state.drawPile).toHaveLength(DECK_SIZE - 14 - 3);
  });

  it('refuses moves before the first card is turned over', () => {
    const r = startGame(2, 0);
    if (!r.ok) throw new Error(r.error);
    expect(apply(r.state, { type: 'draw', seat: 0 }).ok).toBe(false);
  });
});

describe('playing cards', () => {
  it('plays a card of the same colour and passes the turn on', () => {
    const t = new Table({ players: 3, hands: [['teal 7']] });
    t.play(0, 'teal 7');
    expect(t.top()).toBe('teal 7');
    expect(t.count(0)).toBe(6);
    expect(t.state.turn).toBe(1);
  });

  it('plays a card with the same number in another colour, which changes the colour', () => {
    const t = new Table({ players: 3, hands: [['amber 5']] });
    t.play(0, 'amber 5');
    expect(t.state.colour).toBe('amber');
  });

  it('refuses a card that does not match', () => {
    const t = new Table({ players: 3, hands: [['amber 2']] });
    expect(t.bad(t.playMove(0, 'amber 2'))).toMatch(/does not match/);
  });

  it('refuses a move from a player whose turn it is not', () => {
    const t = new Table({ players: 3, hands: [[], ['teal 8']] });
    expect(t.bad(t.playMove(1, 'teal 8'))).toMatch(/not your turn/);
  });

  it('refuses a card the player does not hold', () => {
    const t = new Table({ players: 3 });
    expect(t.bad({ type: 'play', seat: 0, ref: { epoch: 0, pos: 50 }, cardId: 0 })).toMatch(/do not have/);
  });

  it('needs a colour for a Wild card, and uses it', () => {
    const t = new Table({ players: 3, hands: [['wild']] });
    expect(t.bad(t.playMove(0, 'wild'))).toMatch(/Pick a colour/);
    t.play(0, 'wild', 'violet');
    expect(t.state.colour).toBe('violet');
    expect(t.state.turn).toBe(1);
  });

  it('refuses a colour on a normal card', () => {
    const t = new Table({ players: 3, hands: [['teal 7']] });
    expect(t.bad(t.playMove(0, 'teal 7', 'coral'))).toMatch(/Only Wild/);
  });

  it('allows Wild Draw 4 at any time, even with a matching card in hand', () => {
    const t = new Table({ players: 3, hands: [['teal 7', 'wild4']] });
    t.play(0, 'wild4', 'amber');
    expect(t.state.colour).toBe('amber');
    expect(t.count(1)).toBe(11);
    expect(t.lastOpen.filter((o) => o.to === 1)).toHaveLength(4);
    expect(t.state.turn).toBe(2);
  });
});

describe('special cards', () => {
  it('Skip: the next player misses their turn', () => {
    const t = new Table({ players: 3, hands: [['teal skip']] });
    t.play(0, 'teal skip');
    expect(t.state.turn).toBe(2);
  });

  it('Reverse: play changes direction', () => {
    const t = new Table({ players: 3, hands: [['teal reverse'], [], ['teal 9']] });
    t.play(0, 'teal reverse');
    expect(t.state.dir).toBe(-1);
    expect(t.state.turn).toBe(2);
    t.play(2, 'teal 9');
    expect(t.state.turn).toBe(1);
  });

  it('Reverse with 2 players works like Skip', () => {
    const t = new Table({ players: 2, hands: [['teal reverse']] });
    t.play(0, 'teal reverse');
    expect(t.state.turn).toBe(0);
  });

  it('Draw 2: the next player draws 2 and misses their turn, so it cannot be stacked', () => {
    const t = new Table({ players: 3, hands: [['teal draw2'], ['coral draw2']] });
    t.play(0, 'teal draw2');
    expect(t.count(1)).toBe(9);
    expect(t.lastOpen.filter((o) => o.to === 1)).toHaveLength(2);
    expect(t.state.turn).toBe(2);
    expect(t.bad(t.playMove(1, 'coral draw2'))).toMatch(/not your turn/);
  });
});

describe('drawing', () => {
  it('draws 1 card for the player only, and the turn waits for Play it or Keep', () => {
    const t = new Table({ players: 3, pile: ['coral 9'] });
    t.draw(0);
    expect(t.count(0)).toBe(8);
    expect(t.lastOpen).toEqual([{ ref: t.state.drawn, to: 0 }]);
    expect(t.state.turn).toBe(0);
    t.keep(0);
    expect(t.state.turn).toBe(1);
  });

  it('after drawing, only the drawn card can be played', () => {
    const t = new Table({ players: 3, hands: [['teal 7']], pile: ['coral 9'] });
    t.draw(0);
    expect(t.bad(t.playMove(0, 'teal 7'))).toMatch(/just drew/);
    expect(t.bad(t.playMove(0, 'coral 9'))).toMatch(/does not match/);
  });

  it('the drawn card can be played straight away', () => {
    const t = new Table({ players: 3, pile: ['teal 9'] });
    t.draw(0);
    t.play(0, 'teal 9');
    expect(t.top()).toBe('teal 9');
    expect(t.state.turn).toBe(1);
  });

  it('allows drawing even with a playable card', () => {
    const t = new Table({ players: 3, hands: [['teal 7']] });
    t.draw(0);
    expect(t.count(0)).toBe(8);
  });

  it('refuses a second draw, and Keep without drawing', () => {
    const t = new Table({ players: 3 });
    expect(t.bad({ type: 'keep', seat: 0 })).toMatch(/after drawing/);
    t.draw(0);
    expect(t.bad({ type: 'draw', seat: 0 })).toMatch(/already drew/);
  });

  it('becomes a pass when both piles are empty', () => {
    const t = new Table({ players: 3 });
    t.state.drawPile = [];
    expect(canOnlyPass(t.state)).toBe(true);
    t.draw(0);
    expect(t.count(0)).toBe(7);
    expect(t.state.turn).toBe(1);
  });
});

describe('last card', () => {
  it('can only be called with exactly 2 cards, once', () => {
    const t = new Table({ players: 3 });
    expect(t.bad({ type: 'lastCard', seat: 0 })).toMatch(/2 cards/);
    t.setHand(0, ['teal 7', 'coral 9']);
    t.ok({ type: 'lastCard', seat: 0 });
    expect(t.bad({ type: 'lastCard', seat: 0 })).toMatch(/already/);
  });

  it('forgetting it lets another player catch you for 2 cards, and only the first catch counts', () => {
    const t = new Table({ players: 3 });
    t.setHand(0, ['teal 7', 'coral 9']);
    t.play(0, 'teal 7');
    expect(t.state.catchable).toBe(0);
    t.ok({ type: 'catch', seat: 2, target: 0 });
    expect(t.count(0)).toBe(3);
    expect(t.lastOpen.filter((o) => o.to === 0)).toHaveLength(2);
    expect(t.bad({ type: 'catch', seat: 1, target: 0 })).toMatch(/cannot be caught/);
  });

  it('calling it in time means nobody can catch you', () => {
    const t = new Table({ players: 3 });
    t.setHand(0, ['teal 7', 'coral 9']);
    t.ok({ type: 'lastCard', seat: 0 });
    t.play(0, 'teal 7');
    expect(t.state.catchable).toBe(null);
    expect(t.bad({ type: 'catch', seat: 1, target: 0 })).toMatch(/cannot be caught/);
  });

  it('the next player may catch before moving', () => {
    const t = new Table({ players: 3 });
    t.setHand(0, ['teal 7', 'coral 9']);
    t.play(0, 'teal 7');
    t.ok({ type: 'catch', seat: 1, target: 0 });
    expect(t.count(0)).toBe(3);
  });

  it('the chance to catch ends when the next player moves', () => {
    const t = new Table({ players: 3 });
    t.setHand(0, ['teal 7', 'coral 9']);
    t.play(0, 'teal 7');
    t.draw(1);
    expect(t.bad({ type: 'catch', seat: 2, target: 0 })).toMatch(/cannot be caught/);
  });

  it('you cannot catch yourself', () => {
    const t = new Table({ players: 3 });
    t.setHand(0, ['teal 7', 'coral 9']);
    t.play(0, 'teal 7');
    expect(t.bad({ type: 'catch', seat: 0, target: 0 })).toMatch(/yourself/);
  });
});

describe('turn timer', () => {
  it('a timeout draws 1 card and ends the turn', () => {
    const t = new Table({ players: 3 });
    t.ok({ type: 'timeout', seat: 0 });
    expect(t.count(0)).toBe(8);
    expect(t.state.timeouts[0]).toBe(1);
    expect(t.state.turn).toBe(1);
  });

  it('a timeout after drawing does not draw again', () => {
    const t = new Table({ players: 3 });
    t.draw(0);
    t.ok({ type: 'timeout', seat: 0 });
    expect(t.count(0)).toBe(8);
    expect(t.state.turn).toBe(1);
  });

  it('only the current player can time out', () => {
    const t = new Table({ players: 3 });
    expect(t.bad({ type: 'timeout', seat: 1 })).toMatch(/turn/);
  });

  it('3 timeouts in a row remove the player, who is then skipped', () => {
    const t = new Table({ players: 3 });
    t.state.timeouts[0] = 2;
    t.ok({ type: 'timeout', seat: 0 });
    expect(t.state.removed[0]).toBe(true);
    expect(t.state.turn).toBe(1);
    t.draw(1);
    t.keep(1);
    t.draw(2);
    t.keep(2);
    expect(t.state.turn).toBe(1);
  });

  it('a real move resets the timeout count', () => {
    const t = new Table({ players: 3 });
    t.state.timeouts[0] = 2;
    t.draw(0);
    t.keep(0);
    expect(t.state.timeouts[0]).toBe(0);
  });

  it('removed players cannot catch', () => {
    const t = new Table({ players: 3 });
    t.state.removed[2] = true;
    t.setHand(0, ['teal 7', 'coral 9']);
    t.play(0, 'teal 7');
    expect(t.bad({ type: 'catch', seat: 2, target: 0 })).toMatch(/Removed/);
  });

  it('if removals leave 1 player, that player wins', () => {
    const t = new Table({ players: 2 });
    t.state.timeouts[0] = 2;
    t.ok({ type: 'timeout', seat: 0 });
    expect(t.state.phase).toBe('over');
    expect(t.state.winner).toBe(1);
  });
});

describe('when the draw pile runs out', () => {
  it('asks for a reshuffle of the discard pile, then gives the drawn card', () => {
    const t = new Table({ players: 3, hands: [['teal 7'], ['teal 8']] });
    t.play(0, 'teal 7');
    t.play(1, 'teal 8');
    t.state.drawPile = [];
    t.draw(2);
    expect(needsReshuffle(t.state)).toBe(true);
    expect(t.count(2)).toBe(7);
    expect(t.bad({ type: 'keep', seat: 2 })).toMatch(/shuffled again/);
    expect(t.bad({ type: 'reshuffle', count: 5 })).toMatch(/Wrong number/);

    t.reshuffle();
    expect(needsReshuffle(t.state)).toBe(false);
    expect(t.state.epoch).toBe(1);
    expect(t.state.discard).toHaveLength(1);
    expect(t.top()).toBe('teal 8');
    expect(t.count(2)).toBe(8);
    expect(t.state.drawn).toEqual({ epoch: 1, pos: 0 });
    expect(t.state.drawPile).toHaveLength(1);
    t.keep(2);
    expect(t.state.turn).toBe(0);
  });

  it('a Draw 2 that empties the pile finishes after the reshuffle', () => {
    const t = new Table({ players: 3, hands: [['teal draw2']] });
    t.state.drawPile = t.state.drawPile.slice(0, 1);
    t.play(0, 'teal draw2');
    expect(t.count(1)).toBe(8);
    expect(t.state.owed).toEqual({ seat: 1, count: 1, ownDraw: false });
    expect(t.state.turn).toBe(2);
    t.reshuffle();
    expect(t.count(1)).toBe(9);
  });

  it('refuses a reshuffle that is not needed', () => {
    const t = new Table({ players: 3 });
    expect(t.bad({ type: 'reshuffle', count: 0 })).toMatch(/No shuffle/);
  });
});

describe('winning', () => {
  it('playing your last card wins and ends the game', () => {
    const t = new Table({ players: 3 });
    t.setHand(0, ['teal 7']);
    t.play(0, 'teal 7');
    expect(t.state.phase).toBe('over');
    expect(t.state.winner).toBe(0);
    expect(t.bad({ type: 'draw', seat: 1 })).toMatch(/over/);
  });

  it('a last Draw 2 has no effect', () => {
    const t = new Table({ players: 3 });
    t.setHand(0, ['teal draw2']);
    t.play(0, 'teal draw2');
    expect(t.state.winner).toBe(0);
    expect(t.count(1)).toBe(7);
  });
});

describe('state safety', () => {
  it('never changes the state it was given', () => {
    const t = new Table({ players: 3, hands: [['teal 7']] });
    const before = JSON.stringify(t.state);
    apply(t.state, t.playMove(0, 'teal 7'));
    apply(t.state, { type: 'draw', seat: 0 });
    expect(JSON.stringify(t.state)).toBe(before);
  });
});

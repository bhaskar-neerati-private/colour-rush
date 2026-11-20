// The game rules as a state machine: apply(state, move) gives the next state or an error.
// The state only holds what every phone knows: cards in hands are positions (CardRef), not card ids.
// A card id becomes known when the card is turned over or played.

import { COLOURS, DECK_SIZE, canPlayOn, getCard, isCardId, isNumber, type Colour } from './cards';

export const HAND_SIZE = 7;
export const MAX_TIMEOUTS = 3;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

/** A place in a shuffled deck. Epoch 0 is the first shuffle, each reshuffle adds 1. */
export interface CardRef {
  readonly epoch: number;
  readonly pos: number;
}

export type Phase = 'dealing' | 'playing' | 'over';

/** Draws that are waiting for the discard pile to be shuffled again. */
export interface OwedDraw {
  seat: number;
  count: number;
  /** true when the player drew on their own turn (they may then play or keep the card) */
  ownDraw: boolean;
}

export interface GameState {
  playerCount: number;
  hands: CardRef[][];
  removed: boolean[];
  /** Timeouts in a row, per seat */
  timeouts: number[];
  turn: number;
  dir: 1 | -1;
  phase: Phase;
  /** Card ids, the last one is the top card */
  discard: number[];
  colour: Colour | null;
  epoch: number;
  /** Drawn from the front */
  drawPile: CardRef[];
  /** The card drawn this turn, if any */
  drawn: CardRef | null;
  lastCalled: boolean;
  /** Seat that played down to 1 card without calling Last card, until the next move */
  catchable: number | null;
  owed: OwedDraw | null;
  winner: number | null;
}

export type Move =
  | { type: 'flip'; cardId: number }
  | { type: 'play'; seat: number; ref: CardRef; cardId: number; colour?: Colour }
  | { type: 'draw'; seat: number }
  | { type: 'keep'; seat: number }
  | { type: 'lastCard'; seat: number }
  | { type: 'catch'; seat: number; target: number }
  | { type: 'timeout'; seat: number }
  | { type: 'reshuffle'; count: number };

/** A position that must now be opened: for one seat, or face up for everyone. */
export interface Opening {
  ref: CardRef;
  to: number | 'all';
}

export type Result = { ok: true; state: GameState; open: Opening[] } | { ok: false; error: string };

const fail = (error: string): Result => ({ ok: false, error });
const sameRef = (a: CardRef, b: CardRef) => a.epoch === b.epoch && a.pos === b.pos;
const refs = (epoch: number, count: number): CardRef[] => Array.from({ length: count }, (_, pos) => ({ epoch, pos }));

// ---------- Helpers for other parts of the game ----------

export const topCardId = (s: GameState): number | null => (s.discard.length ? s.discard[s.discard.length - 1] : null);
export const activeCount = (s: GameState) => s.removed.filter((r) => !r).length;
export const needsReshuffle = (s: GameState) => s.owed !== null;
/** The face-up cards that go into the next shuffle: the discard pile without its top card. */
export const reshuffleCardIds = (s: GameState): number[] => s.discard.slice(0, -1);
/** When both piles are empty, "Draw" becomes "Pass". */
export const canOnlyPass = (s: GameState) => s.drawPile.length === 0 && s.discard.length <= 1;

// ---------- Start ----------

/** Deals 7 cards each, starting with `firstSeat`, and asks for the first card to be turned over. */
export function startGame(playerCount: number, firstSeat: number): Result {
  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    return fail(`A game needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
  }
  if (!Number.isInteger(firstSeat) || firstSeat < 0 || firstSeat >= playerCount) return fail('Unknown first player.');

  const s: GameState = {
    playerCount,
    hands: Array.from({ length: playerCount }, () => []),
    removed: Array.from({ length: playerCount }, () => false),
    timeouts: Array.from({ length: playerCount }, () => 0),
    turn: firstSeat,
    dir: 1,
    phase: 'dealing',
    discard: [],
    colour: null,
    epoch: 0,
    drawPile: refs(0, DECK_SIZE),
    drawn: null,
    lastCalled: false,
    catchable: null,
    owed: null,
    winner: null,
  };
  const open: Opening[] = [];
  for (let k = 0; k < playerCount; k++) {
    const seat = (firstSeat + k) % playerCount;
    for (let i = 0; i < HAND_SIZE; i++) {
      const ref = s.drawPile.shift()!;
      s.hands[seat].push(ref);
      open.push({ ref, to: seat });
    }
  }
  open.push({ ref: s.drawPile[0], to: 'all' });
  return { ok: true, state: s, open };
}

// ---------- Moves ----------

/** Applies one move. Never changes `state`; returns a new state or an error message for the screen. */
export function apply(state: GameState, move: Move): Result {
  const s = structuredClone(state);
  const open: Opening[] = [];
  const error = run(s, move, open);
  return error ? fail(error) : { ok: true, state: s, open };
}

function run(s: GameState, m: Move, open: Opening[]): string | null {
  if (s.phase === 'over') return 'The game is over.';
  if (m.type === 'flip') return flip(s, m.cardId, open);
  if (s.phase !== 'playing') return 'The game has not started yet.';
  if (m.type === 'reshuffle') return reshuffle(s, m.count, open);
  if (s.owed) return 'The deck must be shuffled again first.';
  switch (m.type) {
    case 'play': return play(s, m, open);
    case 'draw': return draw(s, m.seat, open);
    case 'keep': return keep(s, m.seat);
    case 'lastCard': return lastCard(s, m.seat);
    case 'catch': return catchPlayer(s, m.seat, m.target, open);
    case 'timeout': return timeout(s, m.seat, open);
    default: return 'Unknown move.';
  }
}

function flip(s: GameState, cardId: number, open: Opening[]): string | null {
  if (s.phase !== 'dealing') return 'The first card is already turned over.';
  if (!isCardId(cardId) || s.discard.includes(cardId)) return 'Unknown card.';
  if (!s.drawPile.shift()) return 'No cards left to turn over.';
  s.discard.push(cardId);
  const card = getCard(cardId);
  if (isNumber(card)) {
    // Keep turning until a number card appears
    s.colour = card.colour;
    s.phase = 'playing';
  } else if (s.drawPile.length) {
    open.push({ ref: s.drawPile[0], to: 'all' });
  }
  return null;
}

function play(s: GameState, m: Extract<Move, { type: 'play' }>, open: Opening[]): string | null {
  if (m.seat !== s.turn) return 'It is not your turn.';
  const hand = s.hands[m.seat];
  const index = hand.findIndex((r) => sameRef(r, m.ref));
  if (index < 0) return 'You do not have that card.';
  if (s.drawn && !sameRef(s.drawn, m.ref)) return 'You can only play the card you just drew.';
  if (!isCardId(m.cardId) || s.discard.includes(m.cardId)) return 'Unknown card.';

  const card = getCard(m.cardId);
  const top = getCard(topCardId(s)!);
  if (!canPlayOn(card, top, s.colour!)) return 'That card does not match the top card.';
  if (card.colour === null) {
    if (!m.colour || !(COLOURS as readonly string[]).includes(m.colour)) return 'Pick a colour for the Wild card.';
  } else if (m.colour !== undefined) {
    return 'Only Wild cards take a colour.';
  }

  s.catchable = null;
  s.timeouts[m.seat] = 0;
  hand.splice(index, 1);
  s.discard.push(m.cardId);
  s.colour = card.colour ?? m.colour!;

  if (hand.length === 0) {
    // Winning ends the game at once, so a last Draw 2 or Wild Draw 4 has no effect
    s.winner = m.seat;
    s.phase = 'over';
    return null;
  }
  if (hand.length === 1 && !s.lastCalled) s.catchable = m.seat;

  let skip = false;
  if (card.value === 'reverse') {
    s.dir = s.dir === 1 ? -1 : 1;
    skip = activeCount(s) === 2; // with 2 players Reverse works like Skip
  } else if (card.value === 'skip') {
    skip = true;
  } else if (card.value === 'draw2' || card.value === 'wild4') {
    drawInto(s, nextSeat(s, m.seat), card.value === 'draw2' ? 2 : 4, false, open);
    skip = true;
  }
  endTurn(s, skip);
  return null;
}

function draw(s: GameState, seat: number, open: Opening[]): string | null {
  if (seat !== s.turn) return 'It is not your turn.';
  if (s.drawn) return 'You already drew a card this turn.';
  s.catchable = null;
  s.timeouts[seat] = 0;
  if (canOnlyPass(s)) {
    endTurn(s, false); // nothing left to draw: this is a pass
    return null;
  }
  drawInto(s, seat, 1, true, open);
  return null;
}

function keep(s: GameState, seat: number): string | null {
  if (seat !== s.turn) return 'It is not your turn.';
  if (!s.drawn) return 'You can only keep a card after drawing.';
  s.timeouts[seat] = 0;
  endTurn(s, false);
  return null;
}

function lastCard(s: GameState, seat: number): string | null {
  if (seat !== s.turn) return 'It is not your turn.';
  if (s.hands[seat].length !== 2) return 'You can only call Last card when you have 2 cards.';
  if (s.lastCalled) return 'You already called Last card.';
  s.lastCalled = true;
  return null;
}

function catchPlayer(s: GameState, seat: number, target: number, open: Opening[]): string | null {
  if (!isSeat(s, seat) || !isSeat(s, target)) return 'Unknown player.';
  if (s.removed[seat]) return 'Removed players cannot catch.';
  if (seat === target) return 'You cannot catch yourself.';
  if (s.catchable !== target) return 'That player cannot be caught now.';
  s.catchable = null;
  drawInto(s, target, 2, false, open);
  return null;
}

function timeout(s: GameState, seat: number, open: Opening[]): string | null {
  if (seat !== s.turn) return 'It is not that player\'s turn.';
  s.catchable = null;
  s.timeouts[seat] += 1;
  if (!s.drawn && !canOnlyPass(s)) drawInto(s, seat, 1, false, open);
  if (s.timeouts[seat] >= MAX_TIMEOUTS) {
    s.removed[seat] = true;
    if (activeCount(s) === 1) {
      s.winner = s.removed.findIndex((r) => !r);
      s.phase = 'over';
      return null;
    }
  }
  endTurn(s, false);
  return null;
}

function reshuffle(s: GameState, count: number, open: Opening[]): string | null {
  if (!s.owed) return 'No shuffle is needed now.';
  if (count !== s.discard.length - 1) return 'Wrong number of cards in the new deck.';
  s.epoch += 1;
  s.drawPile = refs(s.epoch, count);
  s.discard = s.discard.slice(-1);
  const owed = s.owed;
  s.owed = null;
  drawInto(s, owed.seat, owed.count, owed.ownDraw, open);
  return null;
}

// ---------- Internals ----------

const isSeat = (s: GameState, seat: number) => Number.isInteger(seat) && seat >= 0 && seat < s.playerCount;

/** Next seat in the current direction, skipping removed players. */
function nextSeat(s: GameState, from: number): number {
  const n = s.playerCount;
  let i = from;
  for (let k = 0; k < n; k++) {
    i = (i + s.dir + n) % n;
    if (!s.removed[i]) return i;
  }
  return from;
}

function endTurn(s: GameState, skipNext: boolean) {
  s.drawn = null;
  s.lastCalled = false;
  let next = nextSeat(s, s.turn);
  if (skipNext) next = nextSeat(s, next);
  s.turn = next;
}

/** Gives cards from the draw pile. If it runs out and the discard pile can be reshuffled, the rest is owed. */
function drawInto(s: GameState, seat: number, count: number, ownDraw: boolean, open: Opening[]) {
  for (let i = 0; i < count; i++) {
    const ref = s.drawPile.shift();
    if (!ref) {
      if (s.discard.length > 1) s.owed = { seat, count: count - i, ownDraw };
      return;
    }
    s.hands[seat].push(ref);
    open.push({ ref, to: seat });
    if (ownDraw) s.drawn = ref;
  }
}

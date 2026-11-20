// Test helper: a game where the test knows which card is at every position.
// Card names: "teal 7", "coral skip", "amber reverse", "violet draw2", "wild", "wild4".

import { DECK, getCard, type Card, type Colour } from '../../src/rules/cards';
import { apply, reshuffleCardIds, startGame, type CardRef, type GameState, type Move, type Opening } from '../../src/rules/game';

const key = (r: CardRef) => `${r.epoch}:${r.pos}`;

export function matches(card: Card, name: string): boolean {
  const [a, b] = name.split(' ');
  if (b === undefined) return card.colour === null && card.value === a;
  return card.colour === a && card.value === b;
}

export const nameOf = (card: Card) => (card.colour ? `${card.colour} ${card.value}` : card.value);

export interface TableOptions {
  players: number;
  first?: number;
  /** Cards per seat (by seat number). Missing cards are filled with other cards up to 7. */
  hands?: string[][];
  /** Cards turned over at the start. Default: "teal 5". */
  flips?: string[];
  /** The first cards of the draw pile. */
  pile?: string[];
}

export class Table {
  state: GameState;
  lastOpen: Opening[] = [];
  private where = new Map<string, number>();
  private used = new Set<number>();
  private extraPos = 0;

  constructor(opts: TableOptions) {
    const n = opts.players;
    const first = opts.first ?? 0;
    const take = (name: string) => {
      const card = DECK.find((c) => !this.used.has(c.id) && matches(c, name));
      if (!card) throw new Error(`No free card: ${name}`);
      this.used.add(card.id);
      return card.id;
    };
    const dealt: number[][] = Array.from({ length: n }, (_, s) => (opts.hands?.[s] ?? []).map(take));
    const flips = (opts.flips ?? ['teal 5']).map(take);
    const pile = (opts.pile ?? []).map(take);
    const filler = () => {
      const card = DECK.find((c) => !this.used.has(c.id))!;
      this.used.add(card.id);
      return card.id;
    };
    for (const hand of dealt) while (hand.length < 7) hand.push(filler());

    const order: number[] = [];
    for (let k = 0; k < n; k++) order.push(...dealt[(first + k) % n]);
    order.push(...flips, ...pile);
    for (const c of DECK) if (!this.used.has(c.id)) order.push(c.id);
    order.forEach((id, pos) => this.where.set(key({ epoch: 0, pos }), id));

    const start = startGame(n, first);
    if (!start.ok) throw new Error(start.error);
    this.state = start.state;
    this.lastOpen = start.open;
    while (this.state.phase === 'dealing') this.ok({ type: 'flip', cardId: this.idAt(this.state.drawPile[0]) });
  }

  idAt(ref: CardRef): number {
    const id = this.where.get(key(ref));
    if (id === undefined) throw new Error(`Unknown position ${key(ref)}`);
    return id;
  }

  cardAt = (ref: CardRef) => getCard(this.idAt(ref));
  hand = (seat: number) => this.state.hands[seat].map((r) => nameOf(this.cardAt(r)));
  count = (seat: number) => this.state.hands[seat].length;
  top = () => nameOf(getCard(this.state.discard[this.state.discard.length - 1]));

  refOf(seat: number, name: string): CardRef {
    const ref = this.state.hands[seat].find((r) => matches(this.cardAt(r), name));
    if (!ref) throw new Error(`Seat ${seat} has no ${name}`);
    return ref;
  }

  playMove(seat: number, name: string, colour?: Colour): Move {
    const ref = this.refOf(seat, name);
    return { type: 'play', seat, ref, cardId: this.idAt(ref), ...(colour ? { colour } : {}) };
  }

  /** Applies a move that must work. */
  ok(move: Move) {
    const r = apply(this.state, move);
    if (!r.ok) throw new Error(`Move refused: ${r.error}`);
    this.state = r.state;
    this.lastOpen = r.open;
    return r;
  }

  /** Applies a move that must be refused, and returns the error. The state does not change. */
  bad(move: Move): string {
    const r = apply(this.state, move);
    if (r.ok) throw new Error(`Move should have been refused: ${JSON.stringify(move)}`);
    return r.error;
  }

  play = (seat: number, name: string, colour?: Colour) => this.ok(this.playMove(seat, name, colour));
  draw = (seat: number) => this.ok({ type: 'draw', seat });
  keep = (seat: number) => this.ok({ type: 'keep', seat });

  /** Replaces a seat's hand with exactly these cards (for short-hand situations). */
  setHand(seat: number, names: string[]) {
    this.state.hands[seat] = names.map((name) => {
      const card = DECK.find((c) => matches(c, name) && !this.state.discard.includes(c.id))!;
      const ref = { epoch: 99, pos: this.extraPos++ };
      this.where.set(key(ref), card.id);
      return ref;
    });
  }

  /** Runs the reshuffle the rules ask for, keeping the discard pile order. */
  reshuffle() {
    const ids = reshuffleCardIds(this.state);
    const epoch = this.state.epoch + 1;
    ids.forEach((id, pos) => this.where.set(key({ epoch, pos }), id));
    return this.ok({ type: 'reshuffle', count: ids.length });
  }
}

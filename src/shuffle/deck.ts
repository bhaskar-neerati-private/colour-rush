// One shuffled deck (an "epoch"): what every phone knows (DeckRecord) and what only one phone knows (KeySafe).
// Follows docs/fair-shuffle.md, part B.

import { BASE, ONE, cardPoint, invertScalar, mulScalars, parsePoint, parseScalar, randomScalar, scalarToHex, shuffleInPlace } from './group';

/** A player's secret keys for one deck, as text. Shared only for the end-of-game check. */
export interface RevealedKeys {
  lockKey: string;
  boxKeys: string[];
}

/** The public record of one deck. Every phone builds the same record from the shuffle messages. */
export class DeckRecord {
  /** D0: the card points before anyone locks them */
  readonly start: string[];
  /** round1[s]: the list after seat s locked and mixed */
  readonly round1: string[][] = [];
  /** round2[s]: the list after seat s swapped to one padlock per box */
  readonly round2: string[][] = [];
  /** commits[s][j]: seat s's promise for their key to box j (key x BASE) */
  readonly commits: string[][] = [];
  private readonly lookup: Map<string, number>;

  constructor(
    readonly gameId: string,
    readonly epoch: number,
    readonly cardIds: readonly number[],
    readonly seats: number,
  ) {
    if (seats < 2) throw new Error('A deck needs at least 2 players.');
    if (cardIds.length < 1) throw new Error('A deck needs at least 1 card.');
    this.start = cardIds.map((id) => cardPoint(gameId, epoch, id).toHex());
    this.lookup = new Map(this.start.map((hex, i) => [hex, cardIds[i]]));
  }

  get size() {
    return this.cardIds.length;
  }

  /** Whose shuffle step is next, or null when the deck is ready. */
  get next(): { round: 1 | 2; seat: number } | null {
    if (this.round1.length < this.seats) return { round: 1, seat: this.round1.length };
    if (this.round2.length < this.seats) return { round: 2, seat: this.round2.length };
    return null;
  }

  get ready() {
    return this.next === null;
  }

  /** The list the next seat must work on. */
  input(): string[] {
    const next = this.next;
    if (!next) throw new Error('The deck is already shuffled.');
    if (next.round === 1) return next.seat === 0 ? this.start : this.round1[next.seat - 1];
    return next.seat === 0 ? this.round1[this.seats - 1] : this.round2[next.seat - 1];
  }

  /** The shuffled deck: position j holds one card under one padlock from every player. */
  get final(): string[] {
    if (!this.ready) throw new Error('The deck is not shuffled yet.');
    return this.round2[this.seats - 1];
  }

  /** Records a Round 1 list. Returns an error for the screen, or null. */
  addLock(seat: number, points: unknown): string | null {
    const next = this.next;
    if (!next || next.round !== 1 || next.seat !== seat) return 'It is not this player\'s turn to shuffle.';
    const list = cleanPoints(points, this.size);
    if (typeof list === 'string') return list;
    this.round1.push(list);
    return null;
  }

  /** Records a Round 2 list and the key promises. Returns an error for the screen, or null. */
  addRelock(seat: number, points: unknown, commits: unknown): string | null {
    const next = this.next;
    if (!next || next.round !== 2 || next.seat !== seat) return 'It is not this player\'s turn to shuffle.';
    const list = cleanPoints(points, this.size);
    if (typeof list === 'string') return list;
    const promises = cleanPoints(commits, this.size);
    if (typeof promises === 'string') return 'The key promises are not valid.';
    this.round2.push(list);
    this.commits.push(promises);
    return null;
  }

  /** The card id for an opened point, if it is a card of this deck. */
  cardOf(pointHex: string): number | null {
    return this.lookup.get(pointHex) ?? null;
  }
}

/** Checks a list from another phone and returns it in standard form, or an error. */
function cleanPoints(points: unknown, size: number): string[] | string {
  if (!Array.isArray(points) || points.length !== size) return 'The card list has the wrong length.';
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of points) {
    const point = parsePoint(p);
    if (!point) return 'The card list has a card that is not valid.';
    const hex = point.toHex();
    if (seen.has(hex)) return 'The card list has the same card twice.';
    seen.add(hex);
    out.push(hex);
  }
  return out;
}

const pointOf = (hex: string) => {
  const p = parsePoint(hex);
  if (!p) throw new Error('Bad point in the deck record.');
  return p;
};

/** One phone's secret keys. They never leave the phone, except one box key at a time and at the end. */
export class KeySafe {
  private readonly secrets = new Map<number, { lockKey: bigint; boxKeys: bigint[] }>();

  /** Round 1 for this phone: lock every card with one new key, then mix. Call when it is this phone's step. */
  lock(deck: DeckRecord): string[] {
    const lockKey = randomScalar();
    this.secrets.set(deck.epoch, { lockKey, boxKeys: [] });
    return shuffleInPlace(deck.input().map((hex) => pointOf(hex).multiply(lockKey).toHex()));
  }

  /** Round 2 for this phone: swap the lock for one new key per box, and promise each key. */
  relock(deck: DeckRecord): { points: string[]; commits: string[] } {
    const secret = this.secrets.get(deck.epoch);
    if (!secret) throw new Error('This phone has no lock key for this deck.');
    const unlock = invertScalar(secret.lockKey);
    const input = deck.input();
    secret.boxKeys = input.map(() => randomScalar());
    return {
      points: input.map((hex, j) => pointOf(hex).multiply(mulScalars(secret.boxKeys[j], unlock)).toHex()),
      commits: secret.boxKeys.map((k) => BASE.multiply(k).toHex()),
    };
  }

  /** This phone's key for one box, to send to the player who is opening it. */
  share(epoch: number, pos: number): string {
    const key = this.secrets.get(epoch)?.boxKeys[pos];
    if (key === undefined) throw new Error(`No key for box ${pos} in deck ${epoch}.`);
    return scalarToHex(key);
  }

  /** All keys for one deck, for the end-of-game check. */
  reveal(epoch: number): RevealedKeys {
    const secret = this.secrets.get(epoch);
    if (!secret) throw new Error(`No keys for deck ${epoch}.`);
    return { lockKey: scalarToHex(secret.lockKey), boxKeys: secret.boxKeys.map(scalarToHex) };
  }
}

// ---------- Opening boxes ----------
// Checks use multiplyUnsafe (about 35% faster). It is only "unsafe" for keys that must stay secret,
// and the keys here have already been shared. Locking while shuffling keeps the safe multiply.

/** Checks a box key from `seat` against the promise they made in Round 2. */
export function checkShare(deck: DeckRecord, seat: number, pos: number, keyHex: unknown): boolean {
  const key = parseScalar(keyHex);
  const promise = deck.commits[seat]?.[pos];
  return key !== null && promise !== undefined && BASE.multiplyUnsafe(key).toHex() === promise;
}

/** Opens a box with every player's key (in seat order). Returns the card id, or null if it does not open. */
export function openBox(deck: DeckRecord, pos: number, keysHex: readonly unknown[]): number | null {
  if (!deck.ready || keysHex.length !== deck.seats || pos < 0 || pos >= deck.size) return null;
  let all = ONE;
  for (const hex of keysHex) {
    const key = parseScalar(hex);
    if (key === null) return null;
    all = mulScalars(all, key);
  }
  return deck.cardOf(pointOf(deck.final[pos]).multiplyUnsafe(invertScalar(all)).toHex());
}

export type PlayCheck = 'ok' | 'wrong card' | 'cannot open';

/** Checks that a played box really holds the card the player named. */
export function checkPlayedCard(deck: DeckRecord, pos: number, keysHex: readonly unknown[], claimedCardId: number): PlayCheck {
  const opened = openBox(deck, pos, keysHex);
  if (opened === null) return 'cannot open';
  return opened === claimedCardId ? 'ok' : 'wrong card';
}

// ---------- End-of-game check ----------

export type AuditResult = { ok: true } | { ok: false; seat: number; reason: string };

/** Replays one deck's shuffle with everyone's keys (fair-shuffle.md, B7). Names the first player whose step fails. */
export function auditDeck(deck: DeckRecord, revealed: readonly (RevealedKeys | undefined)[]): AuditResult {
  if (!deck.ready) return { ok: false, seat: deck.next!.seat, reason: 'Their shuffle step never arrived.' };

  const keys: { lockKey: bigint; boxKeys: bigint[] }[] = [];
  for (let s = 0; s < deck.seats; s++) {
    const r = revealed[s];
    const lockKey = parseScalar(r?.lockKey);
    const boxKeys = Array.isArray(r?.boxKeys) ? r.boxKeys.map(parseScalar) : [];
    if (lockKey === null || boxKeys.length !== deck.size || boxKeys.some((k) => k === null)) {
      return { ok: false, seat: s, reason: 'They did not share their keys.' };
    }
    keys.push({ lockKey, boxKeys: boxKeys as bigint[] });
  }

  // Round 1: unlocking each player's list must give the same cards they received (only the order may change)
  for (let s = 0; s < deck.seats; s++) {
    const input = s === 0 ? deck.start : deck.round1[s - 1];
    const unlock = invertScalar(keys[s].lockKey);
    const unlocked = deck.round1[s].map((hex) => pointOf(hex).multiplyUnsafe(unlock).toHex()).sort();
    const expected = [...input].sort();
    if (unlocked.some((hex, i) => hex !== expected[i])) {
      return { ok: false, seat: s, reason: 'Their shuffle changed the cards.' };
    }
  }

  // Round 2: each box must use exactly the promised key
  for (let s = 0; s < deck.seats; s++) {
    const input = s === 0 ? deck.round1[deck.seats - 1] : deck.round2[s - 1];
    const unlock = invertScalar(keys[s].lockKey);
    for (let j = 0; j < deck.size; j++) {
      const k = keys[s].boxKeys[j];
      if (BASE.multiplyUnsafe(k).toHex() !== deck.commits[s][j]) {
        return { ok: false, seat: s, reason: 'Their keys did not match their promise.' };
      }
      if (pointOf(input[j]).multiplyUnsafe(mulScalars(k, unlock)).toHex() !== deck.round2[s][j]) {
        return { ok: false, seat: s, reason: 'Their padlocks did not match.' };
      }
    }
  }
  return { ok: true };
}

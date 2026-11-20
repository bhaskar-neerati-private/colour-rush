import { DeckRecord, KeySafe } from '../../src/shuffle/deck';

export const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Runs every player's Round 1 and Round 2 step in order. `tamper` can change a list before it is sent. */
export function shuffleDeck(
  deck: DeckRecord,
  safes: KeySafe[],
  tamper?: (step: { round: 1 | 2; seat: number }, list: { points: string[]; commits?: string[] }) => void,
) {
  while (deck.next) {
    const step = deck.next;
    const safe = safes[step.seat];
    if (step.round === 1) {
      const sent = { points: safe.lock(deck) };
      tamper?.(step, sent);
      const err = deck.addLock(step.seat, sent.points);
      if (err) throw new Error(err);
    } else {
      const sent = safe.relock(deck);
      tamper?.(step, sent);
      const err = deck.addRelock(step.seat, sent.points, sent.commits);
      if (err) throw new Error(err);
    }
  }
}

/** A new deck shuffled by `players` honest players. */
export function honestDeck(players: number, cardIds = range(108), gameId = 'test-game', epoch = 0) {
  const deck = new DeckRecord(gameId, epoch, cardIds, players);
  const safes = range(players).map(() => new KeySafe());
  shuffleDeck(deck, safes);
  return { deck, safes };
}

/** Every player's key for one box, in seat order. */
export const allKeys = (safes: KeySafe[], epoch: number, pos: number) => safes.map((s) => s.share(epoch, pos));

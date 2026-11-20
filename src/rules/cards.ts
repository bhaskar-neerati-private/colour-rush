// The 108 cards and the matching rule.

export const COLOURS = ['coral', 'amber', 'teal', 'violet'] as const;
export type Colour = (typeof COLOURS)[number];

export const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2', 'wild', 'wild4'] as const;
export type Value = (typeof VALUES)[number];

export interface Card {
  readonly id: number;
  /** null for Wild and Wild Draw 4 */
  readonly colour: Colour | null;
  readonly value: Value;
}

export const DECK_SIZE = 108;

function buildDeck(): Card[] {
  const cards: Card[] = [];
  const add = (colour: Colour | null, value: Value, times: number) => {
    for (let i = 0; i < times; i++) cards.push(Object.freeze({ id: cards.length, colour, value }));
  };
  for (const colour of COLOURS) {
    add(colour, '0', 1);
    for (let n = 1; n <= 9; n++) add(colour, String(n) as Value, 2);
    add(colour, 'skip', 2);
    add(colour, 'reverse', 2);
    add(colour, 'draw2', 2);
  }
  add(null, 'wild', 4);
  add(null, 'wild4', 4);
  return cards;
}

/** All cards, ids 0 to 107. */
export const DECK: readonly Card[] = Object.freeze(buildDeck());

export const isCardId = (id: unknown): id is number => Number.isInteger(id) && (id as number) >= 0 && (id as number) < DECK_SIZE;

export function getCard(id: number): Card {
  if (!isCardId(id)) throw new Error(`Unknown card id: ${id}`);
  return DECK[id];
}

export const isWild = (card: Card) => card.colour === null;
export const isNumber = (card: Card) => /^\d$/.test(card.value);

export const COLOUR_NAMES: Readonly<Record<Colour, string>> = { coral: 'Coral', amber: 'Amber', teal: 'Teal', violet: 'Violet' };
const VALUE_NAMES: Partial<Record<Value, string>> = { skip: 'Skip', reverse: 'Reverse', draw2: 'Draw 2', wild: 'Wild', wild4: 'Wild Draw 4' };

/** For the screen, for example "Teal 7", "Coral Draw 2", "Wild Draw 4". */
export function cardName(card: Card): string {
  const value = VALUE_NAMES[card.value] ?? card.value;
  return card.colour ? `${COLOUR_NAMES[card.colour]} ${value}` : value;
}

/** Can `card` be played on `top` when the current colour is `colour`? */
export function canPlayOn(card: Card, top: Card, colour: Colour): boolean {
  if (isWild(card)) return true;
  return card.colour === colour || card.value === top.value;
}

/** Hand order for the screen: by colour, then number and symbol, Wild cards last. */
export function sortCardIds(ids: readonly number[]): number[] {
  const rank = (id: number) => {
    const c = getCard(id);
    const colourRank = c.colour ? COLOURS.indexOf(c.colour) : COLOURS.length;
    return colourRank * 100 + VALUES.indexOf(c.value);
  };
  return [...ids].sort((a, b) => rank(a) - rank(b) || a - b);
}

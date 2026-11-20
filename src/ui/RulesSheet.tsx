// "How to play" panel. Closes on outside click, X and Esc.
import { useEffect } from 'preact/hooks';
import { COLOURS, COLOUR_NAMES, DECK } from '../rules/cards';
import { Card, Shape } from './Card';
import { CloseIcon } from './icons';

const idOf = (colour: string | null, value: string) => DECK.find((c) => c.colour === colour && c.value === value)!.id;

const SPECIAL: [number, string, string][] = [
  [idOf('teal', 'skip'), 'Skip:', 'the next player misses their turn.'],
  [idOf('coral', 'reverse'), 'Reverse:', 'play changes direction. With 2 players it works like Skip.'],
  [idOf('violet', 'draw2'), 'Draw 2:', 'the next player draws 2 cards and misses their turn. Draw 2 cards cannot be stacked.'],
  [idOf(null, 'wild'), 'Wild:', 'play it on anything and pick the next colour.'],
  [idOf(null, 'wild4'), 'Wild Draw 4:', 'pick the next colour. The next player draws 4 cards and misses their turn. You can play it at any time.'],
];

export function RulesSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-label="How to play">
        <div class="sheet-head">
          <h3>How to play</h3>
          <button class="icon-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>
        <div class="rules">
          <h4>Goal</h4>
          <p>Be the first player to get rid of all your cards.</p>
          <h4>Your turn</h4>
          <ul>
            <li>Play one card that matches the top card by <b>colour</b> or by <b>number or symbol</b>.</li>
            <li>Wild cards can be played on anything.</li>
            <li>If you cannot or do not want to play, <b>draw 1 card</b>. If it matches, you can play it straight away. If not, you keep it and your turn ends.</li>
          </ul>
          <h4>Colours</h4>
          <p>Each colour has its own shape, so you can tell them apart even without seeing colour.</p>
          <div class="colour-key">
            {COLOURS.map((c) => (
              <span class="chip" key={c}><Shape colour={c} />{COLOUR_NAMES[c]}</span>
            ))}
          </div>
          <h4>Special cards</h4>
          <div class="rule-cards">
            {SPECIAL.map(([id, title, text]) => (
              <div class="rule-card" key={id}><Card id={id} /><span><b>{title}</b> {text}</span></div>
            ))}
          </div>
          <h4>Last card</h4>
          <p>When you have 2 cards and are about to play one, press <b>Last card!</b> first. If you forget, any player can press <b>Caught!</b> before the next player plays, and you draw 2 cards.</p>
          <h4>Turn timer</h4>
          <p>You have 30 seconds for each turn. If time runs out, you draw a card automatically. After 3 timeouts in a row, you are removed from the game.</p>
          <h4>Fair play</h4>
          <p>Every player helps shuffle the deck, so nobody can see other players' cards, not even the host. After the game, all moves are checked automatically.</p>
          <h4>If someone leaves</h4>
          <p>Every player is needed to draw cards. If a player is gone for 60 seconds, the game ends and you can start a new one.</p>
        </div>
      </div>
    </div>
  );
}

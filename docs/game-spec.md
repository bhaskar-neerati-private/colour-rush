# Colour Rush: game spec

The full game in simple English. The mockup in `temp-ui/` shows every screen described here.

## 1. In one paragraph

2 to 6 friends play on their own phones or computers. One player creates a room and shares a 4-character code or link. When everyone has joined, the host starts the game. Each player gets 7 cards. Players take turns playing a card that matches the top card by colour or by number or symbol. The first player to get rid of all their cards wins. Nobody, not even the host, can see other players' cards.

## 2. Players and roles

- **2 to 6 players.** No computer players.
- **Host:** the player who created the room. The host presses "Start game" and their phone keeps the order of moves (see [message-contract.md](message-contract.md)). The host **cannot** see other players' cards or change them.
- **Seat order:** the order players joined the waiting room. Play starts with a random player, chosen by the host's phone when the game starts.

## 3. The deck (108 cards)

Four colours, each with its own shape so colour-blind players can tell them apart:

| Colour | Shape |
|---|---|
| Coral | Circle |
| Amber | Triangle |
| Teal | Square |
| Violet | Diamond |

Per colour (25 cards each, 100 in total):

| Card | Count |
|---|---|
| 0 | 1 |
| 1 to 9 | 2 of each |
| Skip | 2 |
| Reverse | 2 |
| Draw 2 | 2 |

Plus 8 cards without a colour:

| Card | Count |
|---|---|
| Wild | 4 |
| Wild Draw 4 | 4 |

Each of the 108 cards has a fixed id from 0 to 107, so two "Teal 7" cards are still different cards.

## 4. Starting a game

1. The host presses "Start game". All phones shuffle the deck together (see [fair-shuffle.md](fair-shuffle.md)). The screen shows "Shuffling the deck" with each player's progress.
2. Each player gets 7 cards.
3. The next card is turned face up to start the discard pile. **If it is not a number card, keep turning** until a number card appears. The non-number cards turned over go into the discard pile under it.
4. The colour of that number card is the current colour. Play goes clockwise, starting with the random first player.

## 5. A turn

On your turn you do **one** of these:

- **Play a card** that matches the top card of the discard pile by **colour** or by **number or symbol**. Wild and Wild Draw 4 can be played on anything.
- **Draw 1 card.** If the drawn card can be played, you may play it straight away ("Play it") or keep it ("Keep"). If it cannot be played, you keep it. Your turn then ends.

You may draw even when you have a card you could play.

If the draw pile and the discard pile are both empty (all cards are in players' hands), drawing is not possible: the "Draw" button becomes "Pass".

## 6. Special cards

| Card | What happens |
|---|---|
| Skip | The next player misses their turn. |
| Reverse | Play changes direction. With 2 players it works like Skip. |
| Draw 2 | The next player draws 2 cards and misses their turn. Draw 2 cannot be answered with another Draw 2 (no stacking). |
| Wild | You pick the next colour. |
| Wild Draw 4 | You pick the next colour. The next player draws 4 cards and misses their turn. You can play it at any time. |

When a Wild card is played, the "Pick a colour" panel opens. The game waits until a colour is picked. This counts as part of the same turn and uses the same timer.

## 7. Last card

- When you have **2 cards** and it is your turn, a **"Last card!"** button appears. Press it **before** playing your second-last card.
- If you play down to 1 card without pressing it, every other player sees a **"Caught!"** button on your tile.
- If someone presses "Caught!" **before the next player's move** (play, draw or keep), you draw 2 cards. Only the first "Caught!" counts.
- After the next player's move, you are safe and the "Caught!" button disappears.

## 8. Winning

- The first player to play their last card wins straight away. If that card was a Draw 2 or Wild Draw 4, the draw does not happen.
- One round per match. No points.
- Game over screen: the winner, everyone's remaining card count, and the end-of-game check result.

## 9. Turn timer

- 30 seconds per turn, shown as a countdown ring.
- The host's phone keeps the time for everyone (one clock, so all phones agree).
- If time runs out, you automatically draw 1 card and your turn ends.
- After **3 timeouts in a row** you are removed from the game. Your cards are put aside and not used again in this game.
- A removed player's phone **keeps helping in the background** (it still holds padlock keys that other players need). If a removed player closes the game, the game ends for everyone.
- The removed player sees: "You were removed. You missed 3 turns in a row, so you were removed from this game. Keep this page open until the game ends, other players need it." with a "Leave" button. "Leave" first asks "Leave this game?" because leaving ends the game for everyone.
- Other players see "Removed" on that player's tile instead of a card count, and the status line says "Maya missed 3 turns in a row and was removed."
- Removed players are skipped in turn order. **If removals leave only 1 player in the game, that player wins** (agreed 2026-11-20).
- Any real move (play, draw or keep) resets your timeout count to 0.

## 10. When the draw pile runs out

- All cards in the discard pile except the top one are shuffled again by all phones together, with new padlocks.
- The "Shuffling the deck" screen shows again. Play continues after it.

## 11. When a player disconnects or leaves

Every player's phone is needed to open cards, so the game cannot go on without them.

- **Lost connection** (for example, the phone switched from Wi-Fi to mobile data): other players see a banner, "Ravi lost connection. Waiting 50s for them to come back." The countdown starts at 60 seconds. If Ravi's game is still open, it reconnects by itself and play continues.
- **Reloading or closing the page** counts as leaving. A reloaded page cannot rejoin, because the padlock keys were lost.
- After 60 seconds, or when a player leaves: "Ravi left the game. Every player is needed to draw cards, so this game cannot go on." With 2 or more players left: "Play again with N players" and "Leave". With 1 player left: "Back to home".
- **Leaving on purpose** asks first: "Leave this game? The game will end for everyone, because every player is needed to draw cards." Buttons: "Stay" and "Leave game".
- **If the host leaves**, the game ends for everyone in the same way (the host's phone keeps the order of moves).

## 12. End-of-game check

- When the game ends (someone wins), every phone shares all its secret keys and every phone replays the whole game.
- **"Fair game":** everything matched.
- **"Problem found":** a player's shuffle or cards did not match. The message names the player.
- During the game, every played card is also checked at once. If a card does not match, the game stops with "Problem found".

## 13. Play again

- "Play again" keeps the same room and the same players. The host's phone starts a new game, with a new shuffle and new keys.
- Players who left are not included. New players can join the waiting room between games.

## 14. Screens and UI labels

All labels use UK spelling. See `temp-ui/` for the look.

**Home**
- Title "Colour Rush". Tagline: "A fast card game for 2 to 6 friends. No sign up, no download."
- "Your name" box (up to 16 characters, remembered on this device).
- Buttons: "Create game", "Join game". Link: "How to play".
- Join: "Room code" box (4 characters), "Join" button, "Cancel" link.
- Join errors (shown under the room code box):
  - "This room is full. A game can have up to 6 players."
  - "This game has already started. You can join when the host starts a new one."
  - "This room uses a newer version of Colour Rush. Reload the page to update."

**Waiting room**
- Room code in large letters, "Copy link", "Share" (opens the phone's share menu).
- "Players (N of 6)" list with "Host" tag and "(you)". Empty rows: "Open seat".
- Host: "Start game (N players)", hint "More players can join until you start." With 1 player: button disabled, hint "Share the code. You need at least 2 players to start."
- Other players: "Waiting for Ravi to start the game".
- "Leave" button in the top bar.
- Joining: "Joining room QM7K", "Connecting to the other players...", "Cancel".
- No answer after 10 seconds (the phone cannot tell a wrong code from a blocked network): "Could not find room QM7K", "Check the code. If the code is right, your network may be blocking the connection.", tip about office and mobile networks, "Back to home", "Try again".

**Game table**
- Top bar: game name, "Room QM7K", "How to play" (i) button, "Leave".
- Opponent tiles: first letter, name, card count, turn ring, "Last card" tag, "Caught!" button, "Offline", "Removed".
- Middle: draw pile with count, discard pile, "Colour: Teal" chip, "Clockwise" or "Anticlockwise" chip, status line (for example "Ravi played Skip. Your turn.").
- Your hand: "You (Asha)", card count, "Your turn" tag, timer. 4 x 2 grid, sorted by colour then number, Wild cards last. Playable cards have an outline. More than 8 cards: grid scrolls, with a hint like "5 more cards below, 3 can be played". A drawn card gets a "New" badge.
- Buttons: "Draw" (or "Pass"), "Last card!", "Play it", "Keep". Hint: "Tap an outlined card to play it, or draw."
- Panels: "Pick a colour", "Shuffling the deck", "Ravi left the game", "Leave this game?", "You were removed", "How to play".

**Game over**
- "You win!" or "Maya wins!", "You played all your cards first." or "Maya played all their cards first."
- Check box: "Checking all moves...", then "Fair game" or "Problem found".
- Ranked list with remaining cards. Buttons: "Leave", "Play again". Hint: "Play again keeps the same room and players."

## 15. Not included

Accounts, chat, scores kept between games, spectators, computer players, house-rule settings, sound.

## 16. Decided after the first draft (2026-11-20)

1. **Maths library:** @noble/curves (ristretto255 for padlocks, Ed25519 for message signatures). The browser's built-in maths would make each shuffle take several seconds on a phone.
2. **One "Could not find room" screen** after 10 seconds without an answer, instead of separate "Room not found" and "Could not connect" screens (section 14).
3. **"You were removed" screen** for a player who missed 3 turns (section 9).
4. **Version mismatch join error** (section 14).
5. **"Removed" label** on a removed player's tile (sections 9 and 14).

## 17. Open points

1. **Shuffle speed on phones** (found in phase 3). On the laptop, a 6-player shuffle of 108 cards takes 3.5 to 6 seconds and the end-of-game check about 3.4 seconds. Phones may be 2 to 4 times slower. Needs measuring on real phones before deciding whether anything must change. See fair-shuffle.md B8.

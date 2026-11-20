# Colour Rush: message contract

Every message the phones send each other. The code in `src/network/` and the game logic must follow this file exactly. If something here changes, update this file first.

## 1. How messages travel

- **Trystero** connects every phone directly to every other phone in the room.
  - App id: `colour-rush-v1`. Room id: the room code. The room code is also used as the Trystero room password, so the connection details are encrypted.
  - Strategy: Trystero's default (Nostr relays). Can be changed in one place if it proves unreliable.
- One Trystero action named `msg` carries all messages as JSON.
- **The host's phone keeps the order.** Players send game messages to the host only. The host gives each one the next sequence number and sends it to everyone, including back to the sender. Every phone applies messages strictly in sequence order. This makes all phones agree, for example on who pressed "Caught!" first.
- The host cannot fake a player's message, because every message is signed by its sender (section 2). The host cannot see or change cards, because of the padlocks.

## 2. Identity and signatures

- On page load, each phone makes a new signing key pair (Ed25519, from `@noble/curves`). It lives only in memory. Reloading the page makes a new one, which is why a reloaded page cannot rejoin a game.
- **Player id:** the first 16 hex characters of the SHA-256 hash of the public signing key.
- Every message is signed by its original sender. Phones ignore any message with a bad signature, an unknown sender, or the wrong game id.

## 3. Envelope

Every message has this shape:

```json
{
  "v": 1,
  "type": "play",
  "from": "a1b2c3d4e5f60718",
  "gameId": "f3c9...",
  "n": 17,
  "body": { },
  "sig": "base64..."
}
```

| Field | Meaning |
|---|---|
| v | Message format version. Phones with a different `v` cannot play together. |
| type | Message type (tables below) |
| from | Sender's player id |
| gameId | Random id made by the host for each game. Empty in the waiting room. |
| n | Sender's own counter, +1 per message. Stops old messages being replayed. |
| body | The message content |
| sig | Signature over the canonical JSON of all fields except `sig` |

The host wraps game messages for everyone like this:

```json
{ "type": "ordered", "seq": 42, "msg": { ...original signed envelope... }, "sig": "host signature" }
```

## 4. Waiting room messages

These go directly between a joining player and the host. They are not ordered.

| Type | From | To | Body | Notes |
|---|---|---|---|---|
| `hello` | joining player | host | `{ name, appVersion, signPub }` | Sent when the connection opens. |
| `welcome` | host | that player | `{ playerId, lobby }` | Accepted. |
| `refused` | host | that player | `{ reason }` | `full`, `started` or `version`. Shown as the join errors in game-spec.md. |
| `lobby` | host | everyone | `{ hostId, players: [{ id, name }] }` | Sent whenever someone joins or leaves. Players are in seat order. |
| `bye` | any player | everyone | `{}` | Sent when leaving on purpose. |

Names: 1 to 16 characters, trimmed. If a name is already taken in the room, the host adds a number ("Asha 2").

## 5. Game messages

All of these are sent to the host and come back to everyone as `ordered`.

### Start and shuffle

| Type | From | Body | Checks by every phone |
|---|---|---|---|
| `start` | host | `{ gameId, seats: [ids], firstSeat, appVersion }` | Sender is the host. 2 to 6 seats. Everyone in `seats` is connected. |
| `shuffleLock` | seat s | `{ epoch, step: s, points: [hex] }` | It is seat s's turn in Round 1. List length is right. Every point is valid. |
| `shuffleRelock` | seat s | `{ epoch, step: s, points: [hex] }` | It is seat s's turn in Round 2. Same checks. |
| `reshuffle` | host | `{ epoch, cardIds: [ids] }` | The draw pile is empty and a draw is needed. The ids match the discard pile minus its top card. |

### Opening cards

| Type | From | Body | Checks |
|---|---|---|---|
| `keys` | any player | `{ epoch, keys: [{ pos, key }] }` | The positions are being opened right now (deal, draw, penalty or first card). The sender is not the player receiving those cards (except for the first card, which everyone opens). |

Each phone sends its `keys` automatically as soon as an ordered message makes a position need opening:
- After Round 2 of epoch 0: keys for all dealt positions of other players, plus the first face-up card.
- After `draw`, `timeout`, `catch`, or a Draw 2 or Wild Draw 4 effect: keys for the drawn positions of that player.

### Turns

| Type | From | Body | Checks |
|---|---|---|---|
| `play` | current player | `{ epoch, pos, cardId, key, colour? }` | It is their turn. They hold that position. The key opens the position to `cardId`. The card can be played on the top card. `colour` is required for Wild and Wild Draw 4 and must be one of `coral`, `amber`, `teal`, `violet`. |
| `draw` | current player | `{}` | It is their turn and they have not drawn yet this turn. If both piles are empty, this means "Pass". |
| `keep` | current player | `{}` | They drew this turn and did not play the drawn card. Ends their turn. |
| `lastCard` | current player | `{}` | It is their turn and they have exactly 2 cards. |
| `catch` | any other player | `{ target }` | The target has 1 card, did not press Last card, and the next player has not moved yet. Only the first valid `catch` counts. |
| `timeout` | host | `{ seat }` | Sent by the host when the current player's 30 seconds run out. That player draws 1 and the turn ends. |
| `removed` | host | `{ seat, reason }` | `timeouts` after 3 timeouts in a row. For information only: every phone already removes the player itself when it applies the third `timeout`. |

Playing the drawn card uses the same `play` message. A Wild card's colour is sent inside `play`, so picking a colour is not a separate message.

### Players leaving

| Type | From | Body | Checks |
|---|---|---|---|
| `offline` | host | `{ seat }` | Sent when the host loses the connection to a player. Starts the 60-second countdown on every phone. |
| `online` | host | `{ seat }` | The player came back within 60 seconds (section 6). |
| `ended` | host | `{ reason, seat }` | `left` (gone for 60 seconds, or `bye`). Every phone shows "Ravi left the game". |

If the host itself disconnects, the other phones see Trystero's peer-leave event for the host, wait 60 seconds, and then show "Ravi left the game" on their own.

### End of game

| Type | From | Body | Checks |
|---|---|---|---|
| `auditKeys` | every player | `{ epochs: [{ epoch, lockKey, boxKeys: [hex] }] }` | Sent automatically when someone wins. Every phone runs the end-of-game check in fair-shuffle.md B7 when all have arrived. |
| `playAgain` | host | `{}` | Moves everyone back to a new `start` with the same room. |

## 6. Coming back after a short drop

- If a player's page is still open, Trystero finds the host again by itself.
- The player sends `resume` to the host: `{ gameId, lastSeq }`, signed with the same key as before.
- The host sends `online` to everyone, then re-sends every ordered message after `lastSeq` to that player.
- A reloaded page has a new signing key, so it cannot resume.

## 7. Timing

| What | Time |
|---|---|
| Turn | 30 seconds, measured by the host |
| Waiting for a lost player | 60 seconds |
| Joining: no host answer | 10 seconds, then the "could not find room" screen |
| Shuffle step: a player does not send their list | 60 seconds, then treated as gone |

## 8. Errors that stop the game

| Problem | What every phone shows |
|---|---|
| A played card does not match its key | "Problem found" naming the player |
| A key opens a position to an unknown point | "Problem found" naming the sender |
| A message with a bad signature | Ignored, not shown |
| End-of-game check fails | "Problem found" on the game over screen, naming the player |

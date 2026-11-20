# Colour Rush: fair shuffle ("padlocks")

How the phones shuffle and deal cards so that nobody, not even the host, can see other players' cards or change the deck without being caught.

Part A is the simple version. Part B is the exact method that the code in `src/shuffle/` follows.

---

## Part A: the simple version

### Locked boxes

- Every card is put in a box. Every player has their own padlocks and keys.
- **Round 1 (lock and mix):** player 1 puts a padlock on every box and mixes the boxes. Player 2 does the same, and so on. Now nobody knows which box holds which card.
- **Round 2 (one key per box):** each player in turn swaps their padlock on every box for a **different padlock per box**. Now each box has one padlock from every player, and every padlock has its own key.
- **Dealing or drawing a box:** every other player gives you their key **for that one box**. You open the last padlock with your own key. Only you see the card.
- **Playing a card:** you show everyone your key for that box, so everyone can open it and check that it really is the card you said.
- **End of the game:** everyone shows all their keys. Every phone replays the whole game and checks that nobody swapped, copied or hid cards.

### Why it is fair

- To open a box you need **every** player's key for it. Nobody holds all the keys to another player's cards.
- A played card is checked straight away, so you cannot claim a card you do not have.
- A player who cheats while shuffling (for example, adding an extra Wild Draw 4) is caught by the end-of-game check, and the game over screen names them.
- All of this happens automatically between the phones. Players just see "Shuffling the deck" for a moment.

### What it cannot stop

- A player who refuses to help (closes the game) stops the game. That is why the game ends when a player leaves.
- Friends sharing their screens or telling each other their cards.

---

## Part B: the exact method

### B1. Maths in one paragraph

We use a group where "locking" is multiplying a point by a secret number, and locks can be added and removed in any order (a·(b·P) = b·(a·P)). The group is **ristretto255** (a standard, prime-order group built on Curve25519). A card is a point. A padlock is a secret number (scalar). To lock, multiply the point by the scalar. To unlock, multiply by the inverse of the scalar. Because the group has prime order, there is no known way to learn anything about a locked point without the keys.

**Library (agreed 2026-11-20):** `@noble/curves` (its `ristretto255` part), a small, audited JavaScript library. The browser's built-in maths has no ristretto255 and would be too slow with other methods on phones.

Random numbers always come from `crypto.getRandomValues`.

### B2. Words used below

| Word | Meaning |
|---|---|
| Seat s | Players in seat order, s = 0 to N-1 |
| Epoch | One shuffled deck. Epoch 0 is the first shuffle of a game. Each reshuffle of the discard pile starts a new epoch. |
| Card point C(id) | The point for card id (0 to 107) in this epoch: `hashToRistretto("colour-rush/v1/" + gameId + "/" + epoch + "/" + id)`, with domain tag `colour-rush-v1` |
| G | The standard base point of ristretto255 |
| Promise P_s,j | k_s,j · G. Sent in Round 2 so every phone can check a box key the moment it is shared. It reveals nothing about the key or the card. |
| Lock key e_s | Player s's secret scalar for Round 1 of this epoch |
| Box key k_s,j | Player s's secret scalar for position j in Round 2 of this epoch |
| Position j | A place in the final shuffled deck of this epoch, 0 to M-1 (M = number of cards in this epoch) |

### B3. Shuffling an epoch

Input: the list of card ids in this epoch (all 108 for epoch 0, or the discard pile minus its top card for a reshuffle), in ascending order. D0 = [C(id) for each id].

**Round 1 (lock and mix)**, for seat s = 0, 1, ..., N-1 in order:
1. Pick a random non-zero lock key e_s.
2. Compute [e_s · X for each X in D_s].
3. Shuffle that list with Fisher-Yates using secure random numbers. The result is D_(s+1).
4. Send D_(s+1) to everyone (message `shuffleLock`).

**Round 2 (one key per box)**, starting from R_0 = D_N, for seat s = 0, 1, ..., N-1 in order:
1. Pick a random non-zero box key k_s,j for every position j.
2. Compute R_(s+1)[j] = k_s,j · (e_s^-1 · R_s[j]). No shuffling in this round.
3. Compute the promises P_s,j = k_s,j · G.
4. Send R_(s+1) and the promises to everyone (message `shuffleRelock`).

Every phone checks each list it receives at once: right length, every entry a valid point, and no point twice (a copied card shows up as the same point twice).

The final deck F = R_N. Every phone stores F and all the intermediate lists (they are needed for the end-of-game check).

After Round 2, each player's position j is locked with every player's own box key k_s,j and nothing else.

### B4. Opening a position

- **For one player X** (dealing, drawing, penalty draws): every player s other than X sends k_s,j to everyone (message `keys`). X then computes P = k_X,j^-1 · (product over s≠X of k_s,j^-1) · F[j] and looks up which C(id) equals P. Other players cannot open it, because they do not have k_X,j.
- **For everyone** (turning over the first card): every player sends their own k_s,j, so every phone can open it.
- **Playing a card:** the player sends their own k_X,j with the `play` message. Every phone now has all keys for position j, opens it, and checks it matches the card the player named. If it does not match, the game stops with "Problem found" naming the player.
- **Wrong keys:** every shared key is checked against its promise (k · G must equal P_s,j) the moment it arrives. A wrong key stops the game with "Problem found" naming the sender.
- **A box that will not open** even though every key matched its promise means someone cheated in Round 2. The game stops and the end-of-game check (B7) runs at once, which names the player.

Sending keys is done by the phones automatically. Nobody has to tap anything.

### B5. Dealing order (epoch 0)

- Positions 0 to 6 go to the first player in play order, 7 to 13 to the next, and so on.
- The next positions are turned over for the first card (keep going until a number card, see game-spec.md section 4).
- The remaining positions are the draw pile, drawn from the lowest position upwards.

### B6. Reshuffle (new epoch)

When a player needs to draw and the draw pile of the current epoch is empty:
1. The host's phone sends `reshuffle` with the ids of the discard pile minus its top card. These cards are face up, so every phone knows them.
2. All phones run B3 for the new epoch, with new lock keys and box keys.
3. The new draw pile is the new epoch's final deck. Cards in players' hands stay in their old epochs. A card is always named by (epoch, position).

### B7. End-of-game check

When the game ends, every player sends all their secret keys for every epoch: e_s and all k_s,j (message `auditKeys`). Every phone then checks:

1. **Keys shared:** every player sent a valid lock key and one box key per position. If not: "They did not share their keys."
2. **Round 1:** for every seat s, unlocking D_(s+1) with e_s gives exactly the same set of points as D_s (only the order may differ). If not: "Their shuffle changed the cards."
3. **Round 2 promises:** for every seat s and position j, k_s,j · G equals P_s,j. If not: "Their keys did not match their promise."
4. **Round 2 padlocks:** for every seat s and position j, R_(s+1)[j] equals k_s,j · e_s^-1 · R_s[j]. If not: "Their padlocks did not match."

Keys shared during play and played cards are already checked when they arrive (B4), so they do not need checking again here. Hands need no extra check either: the rules (src/rules) give every position to exactly one player.

Any failure: "Problem found" naming the first player whose step failed. Otherwise: "Fair game".

### B8. Speed (measured 2026-11-20, on the development laptop)

| Step | Time |
|---|---|
| One lock (point multiplication) | about 1.1 ms (0.7 ms for checks, which use the faster `multiplyUnsafe`) |
| Shuffle, 6 players, 108 cards | 3.5 to 6 seconds in total (0.6 to 1 second per player) |
| Open all 108 boxes | about 0.3 seconds |
| End-of-game check, 6 players | about 3.4 seconds |

The table above was measured in the test runner (Node). **In a real browser it is about 5 times faster.** The speed-test page (open the site with `?speedtest`) in Chrome on the same laptop gave:

| Players | Shuffle | End-of-game check |
|---|---|---|
| 2 | 0.4 s | 0.2 s |
| 3 | 0.4 s | 0.3 s |
| 6 | 0.8 s | 0.6 s |

Phones are expected to be 2 to 4 times slower than the laptop, so roughly 2 to 3 seconds for a 6-player shuffle. To be confirmed with the speed-test page on real phones (game-spec.md section 17).

The shuffle keeps the constant-time `multiply` because it uses secret keys. Checks use `multiplyUnsafe`, because their keys are already shared.

### B9. Tests (phase 3)

- Locking and unlocking in any order gives back the same point.
- A shuffle with 2 to 6 simulated players deals every card exactly once.
- A player cannot open another player's card with the keys they receive.
- A changed list in Round 1 or Round 2, or a false promise, is caught by the end-of-game check, and the right player is named.
- A wrong key during play is caught at once.
- Whole simulated games (2 and 3 players) with rules and padlocks together end with "Fair game".
- Built in `src/shuffle/` (group.ts: maths, deck.ts: deck record, key safe, opening, check). Tests in `tests/shuffle/`.

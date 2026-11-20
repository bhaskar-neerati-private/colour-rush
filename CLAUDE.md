# Colour Rush

An online card game for 2 to 6 friends, played on phones or computers.
It runs only on GitHub Pages: no server of our own. Phones talk to each other directly.

## Working rules

These apply to every Claude session in this folder.

- **Discussion mode by default.** When the user asks to discuss or plan, only discuss. Do not edit code or files until the user says **"start the implementation"** (or words that clearly mean it). "Yes", "okay", "sounds good" or answering questions is not approval.
- **Before changing memory or rules files** (Claude memory, this CLAUDE.md), tell the user the planned change in simple English and wait for the go-ahead.
- **Feedback rounds: note first, build once.** When the user gives suggestions or feedback (design, docs or code), only add each point to the round's feedback file (`docs/<topic>-feedback.md`, for example `docs/ui-feedback.md`) as Open, repeat it back in chat and ask about anything unclear. Change nothing else. After "start the implementation", apply all Open points in one go, mark each Closed with the date, and report. A point that cannot be done stays Open with the reason in Notes.
- **Plans go in the chat message itself**, never only in a file.
- **Simple English** in docs, prompts and explanations. **Plain words** in the UI, no jargon.
- **Never write an em dash or an en dash** anywhere: chat, docs, UI text, code comments, commit messages. Use a colon, comma, parentheses or a plain hyphen (-).
- **Git:** never run `git add`, `git commit` or `git push`. The user runs git. Give copy-paste commands as a numbered runbook: short lines, full quoted absolute `cd` paths, what the user should see, and stop or skip checks per step. Every push needs its own explicit OK.
- **Build in phases** (see below). Show the plan for a phase in chat, wait for "start the implementation", then stop after the phase for the user's OK.

## Decisions (agreed with the user)

- **Name:** Colour Rush. UK spelling everywhere ("colour", not "color").
- **Players:** 2 to 6, online only, joined by a 4-character room code or link. No computer players.
- **Rules:** see [docs/game-spec.md](docs/game-spec.md). Draw 1 and you may play it. No stacking of Draw 2. Wild Draw 4 can be played at any time. Last card button with "Caught!" penalty of 2 cards. 30-second turns. One round per match, then "Play again".
- **Fair play:** cryptographic shuffle ("padlocks"), so nobody, not even the host, can see other hands. Every played card is checked at once, and the whole game is checked at the end. See [docs/fair-shuffle.md](docs/fair-shuffle.md).
- **Connection:** Trystero (direct phone-to-phone connections, found through free public relays). If a player is gone for 60 seconds, the game ends.
- **Look:** the mockup in `temp-ui/` is the reference for every screen. Open `temp-ui/index.html` in a browser.
- `temp-ui/` is kept on this computer only and is not in git.
- **Libraries:** Trystero (connections), @noble/curves (padlock maths and message signatures).
- **Stack:** Vite, TypeScript, Preact, Vitest. GitHub Actions builds and publishes to GitHub Pages on every push.

## Docs

| File | What it holds |
|---|---|
| [docs/game-spec.md](docs/game-spec.md) | The full game: deck, rules, screens, UI labels |
| [docs/fair-shuffle.md](docs/fair-shuffle.md) | The padlock method, in simple words and in exact steps |
| [docs/message-contract.md](docs/message-contract.md) | Every message the phones send each other |
| [docs/ui-feedback.md](docs/ui-feedback.md) | UI feedback rounds (Open and Closed points) |

## Code layout (from phase 1)

```
src/
  rules/     game rules only: what can be played, whose turn, who wins (no UI, no network)
  shuffle/   padlock maths: lock, mix, unlock, end-of-game check (no UI, no network)
  network/   Trystero: rooms, players, sending and receiving messages
  ui/        Preact screens, styles taken from temp-ui/
tests/       Vitest tests for rules/ and shuffle/
```

`rules/` and `shuffle/` must stay free of UI and network code so they can be fully tested.

## Build phases

1. **Setup:** Vite, TypeScript, Preact, Vitest, and a GitHub Actions workflow that publishes a test page to GitHub Pages.
2. **Rules:** the game rules with tests.
3. **Fair shuffle:** the padlock maths with tests.
4. **Rooms:** create and join with Trystero, waiting room. Tested with several browser tabs.
5. **Full game:** real screens wired to rules, shuffle and network, with timer, last card and disconnects.
6. **Finish:** end-of-game check, testing on real phones, final publish.

## Testing several players on one computer

Open the game in 2 to 6 browser tabs (or one normal and one private window). Each tab is a separate player.

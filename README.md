# Colour Rush

A fast card game for 2 to 6 friends, played on phones or computers. No sign up, no download.

- Runs only on GitHub Pages. There is no server: phones connect to each other directly.
- Fair play: every player helps shuffle the deck, so nobody, not even the host, can see other players' cards.

## Run it on your computer

```
npm install
npm run dev
```

Then open the address it shows (usually http://localhost:5173). To try several players, open it in several browser tabs.

## Other commands

| Command | What it does |
|---|---|
| `npm test` | Runs the automatic tests |
| `npm run build` | Builds the game into the `dist` folder |
| `npm run preview` | Shows the built game in the browser |

## Publishing

Every push to `main` runs the tests, builds the game and publishes it to GitHub Pages (see `.github/workflows/deploy.yml`).

## Docs

See [CLAUDE.md](CLAUDE.md) and the [docs](docs) folder.

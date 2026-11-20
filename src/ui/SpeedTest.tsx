// Hidden page (open the site with ?speedtest): times the real shuffle code on this device.
// One device plays every player, so the total is close to how long a game with phones like this one would take
// (network time not included).

import { useEffect, useState } from 'preact/hooks';
import { DeckRecord, KeySafe, auditDeck, openBox } from '../shuffle';
import { APP_VERSION, GAME_NAME } from '../version';
import { Logo } from './Logo';

const PLAYER_COUNTS = [2, 3, 6];
const CARDS = Array.from({ length: 108 }, (_, i) => i);

interface Row {
  players: number;
  shuffleMs: number;
  openMs: number;
  checkMs: number;
}

// Lets the screen update between steps. A message is used instead of setTimeout, which browsers slow down on hidden pages.
// One channel for the whole page: a new channel per pause can be thrown away by the browser before its message arrives.
const channel = new MessageChannel();
const waiting: (() => void)[] = [];
channel.port1.onmessage = () => waiting.shift()?.();
const pause = () =>
  new Promise<void>((resolve) => {
    waiting.push(resolve);
    channel.port2.postMessage(null);
  });
const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

async function measure(players: number, progress: (text: string) => void): Promise<Row> {
  const deck = new DeckRecord(`speed-${players}`, 0, CARDS, players);
  const safes = Array.from({ length: players }, () => new KeySafe());

  let shuffleMs = 0;
  while (deck.next) {
    const step = deck.next;
    progress(`${players} players: shuffling, round ${step.round}, player ${step.seat + 1} of ${players}`);
    await pause();
    const t = performance.now();
    const safe = safes[step.seat];
    if (step.round === 1) {
      deck.addLock(step.seat, safe.lock(deck));
    } else {
      const sent = safe.relock(deck);
      deck.addRelock(step.seat, sent.points, sent.commits);
    }
    shuffleMs += performance.now() - t;
  }

  progress(`${players} players: opening all 108 cards`);
  await pause();
  let t = performance.now();
  for (let pos = 0; pos < deck.size; pos++) openBox(deck, pos, safes.map((s) => s.share(0, pos)));
  const openMs = performance.now() - t;

  progress(`${players} players: end-of-game check`);
  await pause();
  t = performance.now();
  const result = auditDeck(deck, safes.map((s) => s.reveal(0)));
  const checkMs = performance.now() - t;
  if (!result.ok) throw new Error(`Check failed: ${result.reason}`);

  return { players, shuffleMs, openMs, checkMs };
}

function report(rows: Row[]): string {
  const lines = [
    `${GAME_NAME} speed test, version ${APP_VERSION}`,
    `Device: ${navigator.userAgent}`,
    `Processor cores: ${navigator.hardwareConcurrency || 'unknown'}`,
    ...rows.map(
      (r) =>
        `${r.players} players: shuffle ${secs(r.shuffleMs)} (${secs(r.shuffleMs / r.players)} per player), ` +
        `open all cards ${secs(r.openMs)}, end-of-game check ${secs(r.checkMs)}`,
    ),
  ];
  return lines.join('\n');
}

export function SpeedTest() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setRunning(true);
    setRows([]);
    setError('');
    setCopied(false);
    const done: Row[] = [];
    try {
      for (const players of PLAYER_COUNTS) {
        done.push(await measure(players, setStatus));
        setRows([...done]);
      }
      setStatus('Done. Copy the results and send them.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('');
    }
    setRunning(false);
  };

  // ?speedtest&autostart starts at once (used for automatic checks)
  useEffect(() => {
    if (new URLSearchParams(location.search).has('autostart')) void run();
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report(rows));
      setCopied(true);
    } catch {
      setCopied(false);
      setError('Could not copy. Select the text below and copy it by hand.');
    }
  };

  return (
    <div class="app">
      <div class="screen">
        <div class="lobby">
          <div class="hero">
            <Logo />
            <h1 style={{ fontSize: '24px', marginTop: '8px' }}>Speed test</h1>
            <p class="tagline">
              Times the card shuffle on this device for 2, 3 and 6 players. It can take a minute. Keep the screen on and
              this page open.
            </p>
          </div>

          <button class="btn primary block" onClick={run} disabled={running}>
            {running ? 'Testing...' : rows.length ? 'Test again' : 'Start test'}
          </button>
          {status && (
            <p class="small center" style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
              {running && <span class="spin sm" />}
              {status}
            </p>
          )}
          {error && <p class="err center">{error}</p>}

          {rows.length > 0 && (
            <div class="code-box" style={{ textAlign: 'left' }}>
              <table class="speed-table">
                <thead>
                  <tr>
                    <th>Players</th>
                    <th>Shuffle</th>
                    <th>Per player</th>
                    <th>End check</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.players}>
                      <td>{r.players}</td>
                      <td>{secs(r.shuffleMs)}</td>
                      <td>{secs(r.shuffleMs / r.players)}</td>
                      <td>{secs(r.checkMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p class="muted small" style={{ marginTop: '8px' }}>
                "Shuffle" is about how long players would wait at the start of a game if every phone were like this one.
              </p>
            </div>
          )}

          {rows.length > 0 && !running && (
            <>
              <button class="btn block" onClick={copy}>
                {copied ? 'Copied' : 'Copy results'}
              </button>
              <textarea class="input speed-report" readOnly value={report(rows)} />
            </>
          )}

          <p class="muted small center">Version {APP_VERSION}</p>
        </div>
      </div>
    </div>
  );
}

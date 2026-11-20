// Home: your name, Create game, Join game (with a room code), How to play.
import { useState } from 'preact/hooks';
import { cleanName, compareVersions, type RefuseReason } from '../../network/lobby';
import { isValidCode, normaliseCode } from '../../network/roomCode';
import { APP_VERSION, GAME_NAME } from '../../version';
import { Logo } from '../Logo';

const NAME_KEY = 'colour-rush-name';

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Private mode: the name is just not remembered
  }
}

export function refusedText(reason: RefuseReason, hostVersion: string): string {
  if (reason === 'full') return 'This room is full. A game can have up to 6 players.';
  if (reason === 'started') return 'This game has already started. You can join when the host starts a new one.';
  return compareVersions(hostVersion, APP_VERSION) > 0
    ? 'This room uses a newer version of Colour Rush. Reload the page to update.'
    : 'This room uses an older version of Colour Rush. Ask the host to reload the page.';
}

interface Props {
  /** Room code from an invite link or a failed join: opens the join box with it filled in */
  code?: string;
  /** Error from the host, shown under the room code box */
  joinError?: string;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  onRules: () => void;
}

export function Home({ code: initialCode, joinError, onCreate, onJoin, onRules }: Props) {
  const [name, setName] = useState(loadName);
  const [joining, setJoining] = useState(!!initialCode);
  const [code, setCode] = useState(initialCode ?? '');
  const [nameError, setNameError] = useState('');
  const [codeError, setCodeError] = useState(joinError ?? '');

  const checkedName = () => {
    const clean = cleanName(name);
    if (!clean) {
      setNameError('Please type your name.');
      return null;
    }
    saveName(clean);
    return clean;
  };

  const create = () => {
    const n = checkedName();
    if (n) onCreate(n);
  };

  const join = (e?: Event) => {
    e?.preventDefault();
    const n = checkedName();
    const c = normaliseCode(code);
    if (!isValidCode(c)) {
      setCodeError('Room codes have 4 characters, for example QM7K.');
      return;
    }
    if (n) onJoin(c, n);
  };

  return (
    <div class="screen">
      <div class="home">
        <div class="hero">
          <Logo size="lg" />
          <h1>{GAME_NAME}</h1>
          <p class="tagline">
            A fast card game for 2 to 6 friends.
            <br />
            No sign up, no download.
          </p>
        </div>

        <div>
          <label class="lbl" for="name">Your name</label>
          <input
            id="name"
            class={`input ${nameError ? 'error' : ''}`}
            value={name}
            maxLength={16}
            autocomplete="nickname"
            onInput={(e) => {
              setName(e.currentTarget.value);
              setNameError('');
            }}
          />
          {nameError && <p class="err">{nameError}</p>}
        </div>

        {joining ? (
          <form class="join-box" onSubmit={join}>
            <label class="lbl" for="code">Room code</label>
            <div class="row">
              <input
                id="code"
                class={`input code ${codeError ? 'error' : ''}`}
                value={code}
                maxLength={4}
                placeholder="ABCD"
                autocomplete="off"
                autocapitalize="characters"
                onInput={(e) => {
                  setCode(normaliseCode(e.currentTarget.value));
                  setCodeError('');
                }}
              />
              <button class="btn primary" type="submit">Join</button>
            </div>
            {codeError && <p class="err">{codeError}</p>}
            <div class="center">
              <button class="link" type="button" onClick={() => setJoining(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <div class="stack">
            <button class="btn primary block" onClick={create}>Create game</button>
            <button class="btn block" onClick={() => setJoining(true)}>Join game</button>
          </div>
        )}

        <button class="link center-link" onClick={onRules}>How to play</button>
        <p class="muted small center">Version {APP_VERSION}</p>
      </div>
    </div>
  );
}

import { describe, expect, it } from 'vitest';
import { Identity } from '../../src/network/envelope';
import { CODE_ALPHABET, codeFromHash, inviteLink, isValidCode, normaliseCode, randomCode } from '../../src/network/roomCode';
import {
  MAX_PLAYERS, acceptHello, cleanName, compareVersions, isLobbyBody, lobbyBody, newLobby, removePlayer, uniqueName,
  type HelloBody, type Lobby,
} from '../../src/network/lobby';

const VERSION = '1.0.0';

function hello(name: string, version = VERSION, id = new Identity()) {
  return id.sign<HelloBody>('hello', { name, appVersion: version, signPub: id.publicKey });
}

function hostLobby(): Lobby {
  const host = new Identity();
  return newLobby({ id: host.id, name: 'Asha', publicKey: host.publicKey });
}

function accept(lobby: Lobby, name: string) {
  const r = acceptHello(lobby, hello(name), VERSION);
  if (!r.ok) throw new Error(r.reason);
  return r;
}

describe('names', () => {
  it('trims and shortens names, and refuses empty ones', () => {
    expect(cleanName('  Ravi   Kumar  ')).toBe('Ravi Kumar');
    expect(cleanName('A very very long player name')).toBe('A very very long');
    expect(cleanName('   ')).toBeNull();
    expect(cleanName(42)).toBeNull();
  });

  it('adds a number to a name that is already taken', () => {
    expect(uniqueName('Ravi', ['Asha'])).toBe('Ravi');
    expect(uniqueName('Asha', ['Asha'])).toBe('Asha 2');
    expect(uniqueName('asha', ['Asha', 'Asha 2'])).toBe('asha 3');
    expect(uniqueName('Sixteen chars ab', ['Sixteen chars ab'])).toBe('Sixteen chars 2');
  });
});

describe('the host accepting players', () => {
  it('adds a new player with their key', () => {
    const lobby = hostLobby();
    const id = new Identity();
    const r = acceptHello(lobby, hello('Ravi', VERSION, id), VERSION);
    if (!r.ok) throw new Error(r.reason);
    expect(r.lobby.players.map((p) => p.name)).toEqual(['Asha', 'Ravi']);
    expect(r.player).toEqual({ id: id.id, name: 'Ravi', publicKey: id.publicKey });
    expect(lobby.players).toHaveLength(1); // unchanged
  });

  it('gives a repeated name a number', () => {
    const r = accept(hostLobby(), 'Asha');
    expect(r.player.name).toBe('Asha 2');
  });

  it('refuses a 7th player', () => {
    let lobby = hostLobby();
    for (let i = 1; i < MAX_PLAYERS; i++) lobby = accept(lobby, `P${i}`).lobby;
    expect(lobby.players).toHaveLength(6);
    expect(acceptHello(lobby, hello('Late'), VERSION)).toEqual({ ok: false, reason: 'full' });
  });

  it('refuses players once the game has started', () => {
    const lobby = { ...accept(hostLobby(), 'Ravi').lobby, started: true };
    expect(acceptHello(lobby, hello('Late'), VERSION)).toEqual({ ok: false, reason: 'started' });
  });

  it('refuses a different version of the game', () => {
    expect(acceptHello(hostLobby(), hello('Ravi', '0.9.0'), VERSION)).toEqual({ ok: false, reason: 'version' });
  });

  it('refuses a hello with a bad signature, a key that is not theirs, or no name', () => {
    const id = new Identity();
    const forged = { ...hello('Ravi', VERSION, id), sig: '00'.repeat(64) };
    expect(acceptHello(hostLobby(), forged, VERSION)).toEqual({ ok: false, reason: 'invalid' });
    const other = new Identity();
    const wrongKey = id.sign<HelloBody>('hello', { name: 'Ravi', appVersion: VERSION, signPub: other.publicKey });
    expect(acceptHello(hostLobby(), wrongKey, VERSION)).toEqual({ ok: false, reason: 'invalid' });
    expect(acceptHello(hostLobby(), hello('   '), VERSION)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('the same phone saying hello twice is not added twice', () => {
    const id = new Identity();
    const first = acceptHello(hostLobby(), hello('Ravi', VERSION, id), VERSION);
    if (!first.ok) throw new Error();
    const again = acceptHello(first.lobby, hello('Ravi', VERSION, id), VERSION);
    expect(again.ok && again.lobby.players).toHaveLength(2);
  });

  it('removes a player who leaves', () => {
    const r = accept(hostLobby(), 'Ravi');
    expect(removePlayer(r.lobby, r.player.id).players.map((p) => p.name)).toEqual(['Asha']);
  });

  it('only trusts a lobby list that includes its host', () => {
    const r = accept(hostLobby(), 'Ravi');
    expect(isLobbyBody(lobbyBody(r.lobby))).toBe(true);
    expect(isLobbyBody({ hostId: 'nobody', players: lobbyBody(r.lobby).players })).toBe(false);
    expect(isLobbyBody({ hostId: 'x', players: [] })).toBe(false);
    expect(isLobbyBody('junk')).toBe(false);
  });
});

describe('versions', () => {
  it('compares versions number by number', () => {
    expect(compareVersions('0.1.0', '0.2.0')).toBeLessThan(0);
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });
});

describe('room codes', () => {
  it('are 4 characters without look-alikes', () => {
    expect(CODE_ALPHABET).not.toMatch(/[0O1I]/);
    for (let i = 0; i < 200; i++) expect(isValidCode(randomCode())).toBe(true);
  });

  it('clean up what a player typed', () => {
    expect(normaliseCode(' qm7k ')).toBe('QM7K');
    expect(isValidCode('QM7K')).toBe(true);
    expect(isValidCode('QM0K')).toBe(false);
    expect(isValidCode('QM7')).toBe(false);
  });

  it('make and read invite links', () => {
    expect(inviteLink('QM7K', 'https://example.github.io/colour-rush/')).toBe('https://example.github.io/colour-rush/#QM7K');
    expect(codeFromHash('#QM7K')).toBe('QM7K');
    expect(codeFromHash('#qm7k')).toBe('QM7K');
    expect(codeFromHash('#nope!')).toBeNull();
    expect(codeFromHash('')).toBeNull();
  });
});

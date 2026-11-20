// The host's waiting-room rules (docs/message-contract.md section 4). Pure functions, no network.

import { checkSignature, type Envelope } from './envelope';

export const MAX_PLAYERS = 6;
export const NAME_MAX = 16;

export interface LobbyPlayer {
  id: string;
  name: string;
  publicKey: string;
}

export interface Lobby {
  hostId: string;
  players: LobbyPlayer[];
  started: boolean;
}

export interface HelloBody {
  name: string;
  appVersion: string;
  signPub: string;
}

export type RefuseReason = 'full' | 'started' | 'version';

/** What the host sends to everyone in the `lobby` and `welcome` messages. */
export interface LobbyBody {
  hostId: string;
  players: LobbyPlayer[];
}

/** Trims a typed name and keeps it to 1 to 16 characters. Returns null if nothing is left. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
  return name || null;
}

/** "Asha" becomes "Asha 2" (or "Asha 3", ...) if the name is already taken in the room. */
export function uniqueName(name: string, taken: readonly string[]): string {
  const used = new Set(taken.map((n) => n.toLowerCase()));
  if (!used.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) {
    const suffix = ` ${i}`;
    const candidate = name.slice(0, NAME_MAX - suffix.length).trim() + suffix;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

/** Compares versions like 1.2.3. Negative if a is older than b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function newLobby(host: LobbyPlayer): Lobby {
  return { hostId: host.id, players: [host], started: false };
}

export const lobbyBody = (lobby: Lobby): LobbyBody => ({ hostId: lobby.hostId, players: lobby.players.map((p) => ({ ...p })) });

export type HelloResult =
  | { ok: true; lobby: Lobby; player: LobbyPlayer }
  | { ok: false; reason: RefuseReason | 'invalid' };

/** The host's answer to a `hello`. Never changes `lobby`. */
export function acceptHello(lobby: Lobby, hello: Envelope<HelloBody>, hostVersion: string): HelloResult {
  const body = hello.body as Partial<HelloBody> | null;
  if (!body || typeof body.signPub !== 'string' || typeof body.appVersion !== 'string') return { ok: false, reason: 'invalid' };
  if (!checkSignature(hello, body.signPub)) return { ok: false, reason: 'invalid' };

  const existing = lobby.players.find((p) => p.id === hello.from);
  if (existing) return { ok: true, lobby, player: existing }; // the same phone said hello twice

  if (lobby.started) return { ok: false, reason: 'started' };
  if (body.appVersion !== hostVersion) return { ok: false, reason: 'version' };
  if (lobby.players.length >= MAX_PLAYERS) return { ok: false, reason: 'full' };
  const name = cleanName(body.name);
  if (!name) return { ok: false, reason: 'invalid' };

  const player: LobbyPlayer = {
    id: hello.from,
    name: uniqueName(name, lobby.players.map((p) => p.name)),
    publicKey: body.signPub,
  };
  return { ok: true, lobby: { ...lobby, players: [...lobby.players, player] }, player };
}

export function removePlayer(lobby: Lobby, id: string): Lobby {
  return { ...lobby, players: lobby.players.filter((p) => p.id !== id) };
}

/** Checks a `lobby` body from the host before using it. */
export function isLobbyBody(x: unknown): x is LobbyBody {
  if (!x || typeof x !== 'object') return false;
  const b = x as Partial<LobbyBody>;
  return (
    typeof b.hostId === 'string' && Array.isArray(b.players) && b.players.length >= 1 && b.players.length <= MAX_PLAYERS &&
    b.players.every((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.publicKey === 'string') &&
    b.players.some((p) => p.id === b.hostId)
  );
}

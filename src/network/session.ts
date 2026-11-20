// One player's connection to one room: as host (created the room) or as a player who joined.
// The screens subscribe to `view` and call create, join, start and leave.

import { bytesToHex, randomInt } from '../shuffle/group';
import { APP_VERSION } from '../version';
import { Identity, Verifier, checkSignature, isEnvelope, type Envelope } from './envelope';
import {
  acceptHello, isLobbyBody, lobbyBody, newLobby, removePlayer,
  type HelloBody, type Lobby, type LobbyBody, type RefuseReason,
} from './lobby';
import { randomCode } from './roomCode';
import type { Transport, TransportFactory } from './transport';

/** How long a new room waits to be sure nobody else uses its code. */
export const CLAIM_MS = 2000;
/** How long a joining player waits for the host. */
export const NOT_FOUND_MS = 10_000;
const MAX_CODE_TRIES = 5;

export interface PlayerView {
  id: string;
  name: string;
}

export type SessionView =
  | { stage: 'home' }
  | { stage: 'creating' }
  | { stage: 'joining'; code: string }
  | { stage: 'notFound'; code: string }
  | { stage: 'refused'; code: string; reason: RefuseReason; hostVersion: string }
  | { stage: 'lobby'; code: string; isHost: boolean; selfId: string; hostId: string; players: PlayerView[] }
  | {
      stage: 'started'; code: string; isHost: boolean; selfId: string; hostId: string; players: PlayerView[];
      gameId: string; seats: string[]; firstSeat: number;
    }
  | { stage: 'closed'; code: string; hostName: string };

interface StartBody {
  gameId: string;
  seats: string[];
  firstSeat: number;
  appVersion: string;
}

interface RefusedBody {
  reason: RefuseReason;
  appVersion: string;
  signPub: string;
}

const players = (list: LobbyBody['players']): PlayerView[] => list.map(({ id, name }) => ({ id, name }));

export class Session {
  readonly identity = new Identity();
  view: SessionView = { stage: 'home' };
  private readonly listeners = new Set<(view: SessionView) => void>();
  private transport: Transport | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped on every create, join and leave, so late events from an old room are ignored */
  private generation = 0;

  constructor(private readonly connect: TransportFactory) {}

  subscribe(listener: (view: SessionView) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private show(view: SessionView) {
    this.view = view;
    this.listeners.forEach((l) => l(view));
  }

  // ---------- Host ----------

  /** Creates a room with a new code. */
  create(name: string, tries = 1) {
    this.close();
    const gen = ++this.generation;
    const code = randomCode();
    const t = this.open(code);
    this.show({ stage: 'creating' });

    let codeInUse = false;
    t.onPeerJoin(() => {
      codeInUse = true; // nobody can know a brand new code yet, so someone else is using it
    });
    this.timer = setTimeout(() => {
      if (gen !== this.generation) return;
      if (codeInUse && tries < MAX_CODE_TRIES) {
        this.create(name, tries + 1);
        return;
      }
      this.runHost(t, code, name, gen);
    }, CLAIM_MS);
  }

  private runHost(t: Transport, code: string, name: string, gen: number) {
    const me = this.identity;
    let lobby: Lobby = newLobby({ id: me.id, name, publicKey: me.publicKey });
    const peerOf = new Map<string, string>(); // player id -> peer id
    const verifier = new Verifier();
    let started: { gameId: string; seats: string[]; firstSeat: number } | null = null;

    const showLobby = () => {
      const base = { code, isHost: true, selfId: me.id, hostId: me.id, players: players(lobby.players) };
      this.show(started ? { stage: 'started', ...base, ...started } : { stage: 'lobby', ...base });
    };
    const sendLobby = () => t.send(me.sign('lobby', lobbyBody(lobby)));
    const drop = (id: string) => {
      if (!lobby.players.some((p) => p.id === id) || id === me.id) return;
      lobby = removePlayer(lobby, id);
      peerOf.delete(id);
      sendLobby();
      showLobby();
    };

    t.onMessage((data, peer) => {
      if (gen !== this.generation || !isEnvelope(data)) return;
      if (data.type === 'hello') {
        const result = acceptHello(lobby, data as Envelope<HelloBody>, APP_VERSION);
        if (!result.ok) {
          if (result.reason !== 'invalid') {
            const body: RefusedBody = { reason: result.reason, appVersion: APP_VERSION, signPub: me.publicKey };
            t.send(me.sign('refused', body), peer);
          }
          return;
        }
        lobby = result.lobby;
        peerOf.set(result.player.id, peer);
        verifier.add(result.player.id, result.player.publicKey);
        t.send(me.sign('welcome', { playerId: result.player.id, lobby: lobbyBody(lobby) }), peer);
        sendLobby();
        showLobby();
      } else if (data.type === 'bye') {
        if (verifier.check(data) === null) drop(data.from);
      }
    });
    t.onPeerLeave((peer) => {
      if (gen !== this.generation) return;
      for (const [id, p] of peerOf) if (p === peer) drop(id);
    });

    this.startGame = () => {
      if (gen !== this.generation || lobby.started || lobby.players.length < 2) return;
      lobby = { ...lobby, started: true };
      const body: StartBody = {
        gameId: bytesToHex(crypto.getRandomValues(new Uint8Array(8))),
        seats: lobby.players.map((p) => p.id),
        firstSeat: randomInt(lobby.players.length),
        appVersion: APP_VERSION,
      };
      started = { gameId: body.gameId, seats: body.seats, firstSeat: body.firstSeat };
      t.send(me.sign('start', body, body.gameId));
      showLobby();
    };
    showLobby();
  }

  /** Host only: starts the game for everyone in the waiting room. */
  startGame: () => void = () => {};

  // ---------- Joining player ----------

  private onHostBye: (data: Envelope) => void = () => {};

  join(code: string, name: string) {
    this.close();
    const gen = ++this.generation;
    const me = this.identity;
    const t = this.open(code);
    const verifier = new Verifier();
    let hostPeer: string | null = null;
    let hostId = '';
    let list: PlayerView[] = [];
    this.show({ stage: 'joining', code });

    const hello: HelloBody = { name, appVersion: APP_VERSION, signPub: me.publicKey };
    t.onPeerJoin((peer) => {
      if (gen === this.generation && !hostPeer) t.send(me.sign('hello', hello), peer);
    });

    this.timer = setTimeout(() => {
      if (gen !== this.generation || hostPeer) return;
      this.close();
      this.show({ stage: 'notFound', code });
    }, NOT_FOUND_MS);

    t.onMessage((data, peer) => {
      if (gen !== this.generation || !isEnvelope(data)) return;

      if (data.type === 'welcome' && !hostPeer) {
        const body = data.body as { playerId?: string; lobby?: unknown };
        if (body?.playerId !== me.id || !isLobbyBody(body.lobby) || body.lobby.hostId !== data.from) return;
        const host = body.lobby.players.find((p) => p.id === data.from)!;
        if (!checkSignature(data, host.publicKey)) return;
        hostPeer = peer;
        hostId = host.id;
        body.lobby.players.forEach((p) => verifier.add(p.id, p.publicKey));
        verifier.check(data); // remember the host's counter
        list = players(body.lobby.players);
        this.clearTimer();
        this.show({ stage: 'lobby', code, isHost: false, selfId: me.id, hostId, players: list });
        return;
      }

      if (data.type === 'refused' && !hostPeer) {
        const body = data.body as Partial<RefusedBody>;
        if (typeof body?.signPub !== 'string' || !checkSignature(data, body.signPub)) return;
        if (body.reason !== 'full' && body.reason !== 'started' && body.reason !== 'version') return;
        this.close();
        this.show({ stage: 'refused', code, reason: body.reason, hostVersion: String(body.appVersion ?? '') });
        return;
      }

      if (peer !== hostPeer || data.from !== hostId) return;

      if (data.type === 'lobby') {
        if (!isLobbyBody(data.body) || data.body.hostId !== hostId) return;
        if (verifier.check(data) !== null) return;
        data.body.players.forEach((p) => verifier.knows(p.id) || verifier.add(p.id, p.publicKey));
        list = players(data.body.players);
        if (this.view.stage === 'lobby') this.show({ ...this.view, players: list });
      } else if (data.type === 'bye') {
        this.onHostBye(data);
      } else if (data.type === 'start') {
        const body = data.body as Partial<StartBody>;
        if (!Array.isArray(body?.seats) || typeof body.gameId !== 'string' || !Number.isInteger(body.firstSeat)) return;
        if (verifier.check(data) !== null) return;
        this.show({
          stage: 'started', code, isHost: false, selfId: me.id, hostId, players: list,
          gameId: body.gameId, seats: body.seats, firstSeat: body.firstSeat!,
        });
      }
    });

    const hostGone = () => {
      const hostName = list.find((p) => p.id === hostId)?.name ?? 'The host';
      this.close();
      this.show({ stage: 'closed', code, hostName });
    };
    this.onHostBye = (data) => {
      if (gen === this.generation && verifier.check(data) === null) hostGone();
    };
    t.onPeerLeave((peer) => {
      if (gen === this.generation && peer === hostPeer) hostGone();
    });
  }

  // ---------- Both ----------

  /** Leaves the room (telling the others) and goes back to the home screen. */
  leave() {
    if (this.transport && (this.view.stage === 'lobby' || this.view.stage === 'started')) {
      this.transport.send(this.identity.sign('bye', {}));
    }
    this.close();
    this.generation++;
    this.show({ stage: 'home' });
  }

  /** Back to the home screen without telling anyone (after an error). */
  home() {
    this.close();
    this.generation++;
    this.show({ stage: 'home' });
  }

  private open(code: string): Transport {
    this.transport = this.connect(code);
    return this.transport;
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private close() {
    this.clearTimer();
    this.startGame = () => {};
    this.onHostBye = () => {};
    this.transport?.leave();
    this.transport = null;
  }
}

// What the session needs from a connection. The real one uses Trystero (trystero.ts);
// tests use an in-memory one.

export interface Transport {
  /** Sends to one peer, or to everyone in the room when `to` is left out. */
  send(data: unknown, to?: string): void;
  onMessage(handler: (data: unknown, fromPeer: string) => void): void;
  onPeerJoin(handler: (peer: string) => void): void;
  onPeerLeave(handler: (peer: string) => void): void;
  leave(): void;
}

export type TransportFactory = (roomCode: string) => Transport;

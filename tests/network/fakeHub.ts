// An in-memory stand-in for Trystero: rooms by code, peers that join, leave and send messages.
// Delivery is delayed by a few microtasks, like a real network but without timers.

import type { Transport } from '../../src/network/transport';

let nextPeer = 0;
const later = (fn: () => void) => Promise.resolve().then(fn);

export class FakeTransport implements Transport {
  readonly peer = `peer-${++nextPeer}`;
  private messageHandlers: ((data: unknown, from: string) => void)[] = [];
  private joinHandlers: ((peer: string) => void)[] = [];
  private leaveHandlers: ((peer: string) => void)[] = [];
  left = false;

  constructor(private readonly hub: Hub, readonly code: string) {
    const room = hub.room(code);
    for (const other of room) {
      later(() => other.emitJoin(this.peer));
      later(() => this.emitJoin(other.peer));
    }
    room.add(this);
  }

  send(data: unknown, to?: string) {
    if (this.left) return;
    const copy = JSON.parse(JSON.stringify(data)); // like sending over the wire
    for (const other of this.hub.room(this.code)) {
      if (other !== this && (!to || other.peer === to)) later(() => other.emitMessage(copy, this.peer));
    }
  }

  onMessage(h: (data: unknown, from: string) => void) { this.messageHandlers.push(h); }
  onPeerJoin(h: (peer: string) => void) { this.joinHandlers.push(h); }
  onPeerLeave(h: (peer: string) => void) { this.leaveHandlers.push(h); }

  leave() {
    if (this.left) return;
    this.left = true;
    const room = this.hub.room(this.code);
    room.delete(this);
    for (const other of room) later(() => other.emitLeave(this.peer));
  }

  private emitMessage(data: unknown, from: string) { if (!this.left) this.messageHandlers.forEach((h) => h(data, from)); }
  private emitJoin(peer: string) { if (!this.left) this.joinHandlers.forEach((h) => h(peer)); }
  private emitLeave(peer: string) { if (!this.left) this.leaveHandlers.forEach((h) => h(peer)); }
}

export class Hub {
  private readonly rooms = new Map<string, Set<FakeTransport>>();
  room(code: string) {
    if (!this.rooms.has(code)) this.rooms.set(code, new Set());
    return this.rooms.get(code)!;
  }
  connect = (code: string): FakeTransport => new FakeTransport(this, code);
}

/** Lets all pending deliveries happen. */
export async function flush() {
  for (let i = 0; i < 100; i++) await Promise.resolve();
}

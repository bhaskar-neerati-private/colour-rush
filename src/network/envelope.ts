// Signed messages (docs/message-contract.md sections 2 and 3).
// Each phone makes a new Ed25519 key pair when the page opens. Every message is signed by its sender,
// so the host can pass messages on but cannot fake or change them.

import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '../shuffle/group';

export const MESSAGE_VERSION = 1;

export interface Envelope<B = unknown> {
  v: number;
  type: string;
  from: string;
  gameId: string;
  /** The sender's own counter, +1 per message. Stops old messages being replayed. */
  n: number;
  body: B;
  sig: string;
}

const encoder = new TextEncoder();

/** JSON with object keys in a fixed order, so every phone signs and checks the same text. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Numbers must be finite.');
    if (value === undefined) throw new Error('undefined cannot be sent.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

const signedText = (e: Omit<Envelope, 'sig'>) =>
  encoder.encode(canonicalJson({ v: e.v, type: e.type, from: e.from, gameId: e.gameId, n: e.n, body: e.body }));

function hexToBytes(hex: string): Uint8Array | null {
  if (typeof hex !== 'string' || hex.length % 2 !== 0 || !/^[0-9a-f]*$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Player id: the first 16 hex characters of the SHA-256 hash of the public signing key. */
export const playerIdFor = (publicKeyHex: string) => {
  const bytes = hexToBytes(publicKeyHex);
  return bytes ? bytesToHex(sha256(bytes)).slice(0, 16) : '';
};

/** This phone's signing key. Lives only in memory: a reloaded page gets a new one. */
export class Identity {
  readonly publicKey: string;
  readonly id: string;
  private readonly secretKey: Uint8Array;
  private counter = 0;

  constructor() {
    const keys = ed25519.keygen();
    this.secretKey = keys.secretKey;
    this.publicKey = bytesToHex(keys.publicKey);
    this.id = playerIdFor(this.publicKey);
  }

  sign<B>(type: string, body: B, gameId = ''): Envelope<B> {
    const unsigned = { v: MESSAGE_VERSION, type, from: this.id, gameId, n: ++this.counter, body };
    return { ...unsigned, sig: bytesToHex(ed25519.sign(signedText(unsigned), this.secretKey)) };
  }
}

/** True when the envelope is signed by the owner of `publicKeyHex`, and `from` is that key's player id. */
export function checkSignature(e: Envelope, publicKeyHex: string): boolean {
  const pub = hexToBytes(publicKeyHex);
  const sig = hexToBytes(e.sig);
  if (!pub || pub.length !== 32 || !sig || sig.length !== 64) return false;
  if (playerIdFor(publicKeyHex) !== e.from) return false;
  try {
    return ed25519.verify(sig, signedText(e), pub);
  } catch {
    return false;
  }
}

/** Has the basic shape of an envelope (anything from another phone is checked before use). */
export function isEnvelope(x: unknown): x is Envelope {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  return (
    e.v === MESSAGE_VERSION && typeof e.type === 'string' && typeof e.from === 'string' &&
    typeof e.gameId === 'string' && Number.isInteger(e.n) && (e.n as number) > 0 &&
    typeof e.sig === 'string' && 'body' in e
  );
}

/** Checks envelopes from known players: right signature and a counter that only goes up. */
export class Verifier {
  private readonly keys = new Map<string, string>();
  private readonly lastN = new Map<string, number>();

  /** Registers a player's public key. Returns false if the key does not match the id. */
  add(id: string, publicKeyHex: string): boolean {
    if (playerIdFor(publicKeyHex) !== id) return false;
    this.keys.set(id, publicKeyHex);
    return true;
  }

  knows = (id: string) => this.keys.has(id);

  /** Returns an error, or null when the envelope can be trusted. */
  check(x: unknown): string | null {
    if (!isEnvelope(x)) return 'Not a valid message.';
    const key = this.keys.get(x.from);
    if (!key) return 'Message from an unknown player.';
    if (!checkSignature(x, key)) return 'Bad signature.';
    if (x.n <= (this.lastN.get(x.from) ?? 0)) return 'Old message sent again.';
    this.lastN.set(x.from, x.n);
    return null;
  }
}

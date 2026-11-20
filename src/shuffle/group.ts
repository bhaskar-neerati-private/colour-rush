// Basic padlock maths on ristretto255 (see docs/fair-shuffle.md, part B1).
// A card is a point. A padlock key is a secret number (scalar). Locking = multiplying the point by the key.

import { ristretto255, ristretto255_hasher } from '@noble/curves/ed25519.js';

const { Point } = ristretto255;
const Fn = Point.Fn;

export type CardPoint = ReturnType<typeof Point.fromHex>;
export const BASE: CardPoint = Point.BASE;
export const ONE = Fn.ONE;

const DST = 'colour-rush-v1';
const encoder = new TextEncoder();

// ---------- Random numbers ----------

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

function bytesToBigIntLE(bytes: Uint8Array): bigint {
  let n = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]);
  return n;
}

/** A new secret key: random, never zero. */
export function randomScalar(): bigint {
  for (;;) {
    const k = Fn.create(bytesToBigIntLE(randomBytes(64)));
    if (k !== 0n) return k;
  }
}

/** A random whole number from 0 to max - 1, without bias. */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max < 1 || max > 2 ** 32) throw new Error(`Bad range: ${max}`);
  const limit = 2 ** 32 - (2 ** 32 % max);
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

/** Fisher-Yates shuffle with secure random numbers. Changes the array. */
export function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

// ---------- Keys and points ----------

export const mulScalars = (a: bigint, b: bigint) => Fn.mul(a, b);
export const invertScalar = (k: bigint) => Fn.inv(k);

/** The point for a card in one deck: different for every game and every reshuffle. */
export function cardPoint(gameId: string, epoch: number, cardId: number): CardPoint {
  return ristretto255_hasher.hashToCurve(encoder.encode(`colour-rush/v1/${gameId}/${epoch}/${cardId}`), { DST }) as CardPoint;
}

// ---------- Text form, for sending ----------

const HEX = /^[0-9a-f]+$/;

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !HEX.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Reads a point sent by another phone. Returns null for anything that is not a valid, non-zero point. */
export function parsePoint(hex: unknown): CardPoint | null {
  if (typeof hex !== 'string' || hex.length !== 64 || !HEX.test(hex)) return null;
  try {
    const p = Point.fromHex(hex);
    return p.is0() ? null : p;
  } catch {
    return null;
  }
}

export const scalarToHex = (k: bigint) => bytesToHex(Fn.toBytes(k));

/** Reads a key sent by another phone. Returns null for anything that is not a valid, non-zero key. */
export function parseScalar(hex: unknown): bigint | null {
  if (typeof hex !== 'string' || hex.length !== 64) return null;
  const bytes = hexToBytes(hex);
  if (!bytes) return null;
  try {
    const k = Fn.fromBytes(bytes);
    return k === 0n ? null : k;
  } catch {
    return null;
  }
}

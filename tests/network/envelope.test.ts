import { describe, expect, it } from 'vitest';
import { Identity, Verifier, canonicalJson, checkSignature, playerIdFor } from '../../src/network/envelope';

describe('canonical JSON', () => {
  it('writes object keys in a fixed order at every level', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: 'x' } })).toBe('{"a":{"c":"x","d":[1,{"y":2,"z":1}]},"b":1}');
  });

  it('leaves out undefined fields and refuses values that cannot be sent', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(() => canonicalJson(Number.NaN)).toThrow();
  });
});

describe('signed messages', () => {
  it('player ids come from the public key', () => {
    const me = new Identity();
    expect(me.id).toMatch(/^[0-9a-f]{16}$/);
    expect(playerIdFor(me.publicKey)).toBe(me.id);
    expect(new Identity().id).not.toBe(me.id);
  });

  it('a signed message checks out with the sender\'s key, and only with it', () => {
    const me = new Identity();
    const other = new Identity();
    const msg = me.sign('play', { card: 7 }, 'game-1');
    expect(checkSignature(msg, me.publicKey)).toBe(true);
    expect(checkSignature(msg, other.publicKey)).toBe(false);
  });

  it('a changed message is caught', () => {
    const me = new Identity();
    const msg = me.sign('play', { card: 7 }, 'game-1');
    expect(checkSignature({ ...msg, body: { card: 8 } }, me.publicKey)).toBe(false);
    expect(checkSignature({ ...msg, type: 'draw' }, me.publicKey)).toBe(false);
    expect(checkSignature({ ...msg, gameId: 'game-2' }, me.publicKey)).toBe(false);
    expect(checkSignature({ ...msg, n: msg.n + 1 }, me.publicKey)).toBe(false);
  });

  it('nobody can sign in someone else\'s name', () => {
    const me = new Identity();
    const faker = new Identity();
    const fake = { ...faker.sign('play', { card: 7 }), from: me.id };
    expect(checkSignature(fake, me.publicKey)).toBe(false);
    expect(checkSignature(fake, faker.publicKey)).toBe(false);
  });
});

describe('verifier', () => {
  it('accepts messages from known players, in order', () => {
    const me = new Identity();
    const v = new Verifier();
    expect(v.add(me.id, me.publicKey)).toBe(true);
    expect(v.check(me.sign('a', {}))).toBeNull();
    expect(v.check(me.sign('b', {}))).toBeNull();
  });

  it('refuses unknown players, bad signatures, replays and junk', () => {
    const me = new Identity();
    const stranger = new Identity();
    const v = new Verifier();
    v.add(me.id, me.publicKey);
    expect(v.check(stranger.sign('a', {}))).toMatch(/unknown/);
    const first = me.sign('a', {});
    const second = me.sign('b', {});
    expect(v.check(second)).toBeNull();
    expect(v.check(first)).toMatch(/Old message/);
    expect(v.check(second)).toMatch(/Old message/);
    expect(v.check({ ...me.sign('c', {}), sig: '00'.repeat(64) })).toMatch(/signature/);
    expect(v.check({ hello: 1 })).toMatch(/Not a valid/);
    expect(v.check(null)).toMatch(/Not a valid/);
  });

  it('refuses a key that does not belong to the player id', () => {
    const me = new Identity();
    const other = new Identity();
    expect(new Verifier().add(me.id, other.publicKey)).toBe(false);
  });
});

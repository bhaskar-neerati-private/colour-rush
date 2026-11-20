import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAIM_MS, NOT_FOUND_MS, Session, type SessionView } from '../../src/network/session';
import { Identity } from '../../src/network/envelope';
import { Hub, flush } from './fakeHub';

type Of<S extends SessionView['stage']> = Extract<SessionView, { stage: S }>;
const names = (s: Session) => (s.view as Of<'lobby'>).players.map((p) => p.name);

let hub: Hub;
beforeEach(() => {
  vi.useFakeTimers();
  hub = new Hub();
});
afterEach(() => vi.useRealTimers());

async function hostRoom(name = 'Asha') {
  const host = new Session(hub.connect);
  host.create(name);
  expect(host.view.stage).toBe('creating');
  vi.advanceTimersByTime(CLAIM_MS);
  await flush();
  expect(host.view.stage).toBe('lobby');
  return { host, code: (host.view as Of<'lobby'>).code };
}

async function joinRoom(code: string, name: string) {
  const s = new Session(hub.connect);
  s.join(code, name);
  await flush();
  return s;
}

describe('creating and joining a room', () => {
  it('the host gets a room code and is the only player', async () => {
    const { host, code } = await hostRoom();
    expect(code).toMatch(/^[A-Z2-9]{4}$/);
    const view = host.view as Of<'lobby'>;
    expect(view.isHost).toBe(true);
    expect(view.hostId).toBe(host.identity.id);
    expect(names(host)).toEqual(['Asha']);
  });

  it('a player joins and both see the same list', async () => {
    const { host, code } = await hostRoom();
    const ravi = await joinRoom(code, 'Ravi');
    expect(ravi.view.stage).toBe('lobby');
    expect((ravi.view as Of<'lobby'>).isHost).toBe(false);
    expect(names(ravi)).toEqual(['Asha', 'Ravi']);
    expect(names(host)).toEqual(['Asha', 'Ravi']);
  });

  it('later players appear for everyone, and a repeated name gets a number', async () => {
    const { host, code } = await hostRoom();
    const ravi = await joinRoom(code, 'Ravi');
    const ravi2 = await joinRoom(code, 'Ravi');
    expect(names(host)).toEqual(['Asha', 'Ravi', 'Ravi 2']);
    expect(names(ravi)).toEqual(['Asha', 'Ravi', 'Ravi 2']);
    expect(names(ravi2)).toEqual(['Asha', 'Ravi', 'Ravi 2']);
  });

  it('a 7th player is told the room is full', async () => {
    const { code } = await hostRoom();
    for (let i = 1; i < 6; i++) await joinRoom(code, `P${i}`);
    const late = await joinRoom(code, 'Late');
    expect(late.view).toMatchObject({ stage: 'refused', reason: 'full' });
  });

  it('a player who joins a code with no host sees "could not find room" after 10 seconds', async () => {
    const s = new Session(hub.connect);
    s.join('ZZZZ', 'Ravi');
    await flush();
    expect(s.view.stage).toBe('joining');
    vi.advanceTimersByTime(NOT_FOUND_MS);
    expect(s.view).toEqual({ stage: 'notFound', code: 'ZZZZ' });
  });
});

describe('starting', () => {
  it('the host starts and everyone gets the same game id, seats and first player', async () => {
    const { host, code } = await hostRoom();
    const ravi = await joinRoom(code, 'Ravi');
    host.startGame();
    await flush();
    const h = host.view as Of<'started'>;
    const r = ravi.view as Of<'started'>;
    expect(h.stage).toBe('started');
    expect(r.stage).toBe('started');
    expect(r.gameId).toBe(h.gameId);
    expect(r.seats).toEqual([host.identity.id, ravi.identity.id]);
    expect(r.firstSeat).toBe(h.firstSeat);
  });

  it('the host cannot start alone', async () => {
    const { host } = await hostRoom();
    host.startGame();
    await flush();
    expect(host.view.stage).toBe('lobby');
  });

  it('nobody can join after the start', async () => {
    const { host, code } = await hostRoom();
    await joinRoom(code, 'Ravi');
    host.startGame();
    await flush();
    const late = await joinRoom(code, 'Late');
    expect(late.view).toMatchObject({ stage: 'refused', reason: 'started' });
  });
});

describe('leaving', () => {
  it('a player who leaves disappears from everyone\'s list', async () => {
    const { host, code } = await hostRoom();
    const ravi = await joinRoom(code, 'Ravi');
    const maya = await joinRoom(code, 'Maya');
    ravi.leave();
    await flush();
    expect(ravi.view.stage).toBe('home');
    expect(names(host)).toEqual(['Asha', 'Maya']);
    expect(names(maya)).toEqual(['Asha', 'Maya']);
  });

  it('a player whose connection drops disappears too', async () => {
    const { host, code } = await hostRoom();
    const ravi = await joinRoom(code, 'Ravi');
    (ravi as unknown as { transport: { leave(): void } }).transport.leave();
    await flush();
    expect(names(host)).toEqual(['Asha']);
  });

  it('when the host leaves, the room closes for everyone', async () => {
    const { host, code } = await hostRoom();
    const ravi = await joinRoom(code, 'Ravi');
    host.leave();
    await flush();
    expect(ravi.view).toEqual({ stage: 'closed', code, hostName: 'Asha' });
  });
});

describe('fake messages', () => {
  it('a player cannot pretend to be the host', async () => {
    const { code } = await hostRoom();
    const ravi = await joinRoom(code, 'Ravi');
    const faker = hub.connect(code);
    const id = new Identity();
    await flush();
    faker.send(id.sign('lobby', { hostId: id.id, players: [{ id: id.id, name: 'Evil host', publicKey: id.publicKey }] }));
    faker.send(id.sign('start', { gameId: 'x', seats: [id.id], firstSeat: 0, appVersion: '0.1.0' }));
    await flush();
    expect(ravi.view.stage).toBe('lobby');
    expect(names(ravi)).toEqual(['Asha', 'Ravi']);
  });
});

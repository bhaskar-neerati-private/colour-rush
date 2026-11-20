import { afterEach, beforeEach, expect, it, vi, type Mock } from 'vitest';

vi.mock('../../src/network/roomCode', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/network/roomCode')>();
  return { ...real, randomCode: vi.fn() };
});

import { randomCode } from '../../src/network/roomCode';
import { CLAIM_MS, Session } from '../../src/network/session';
import { Hub, flush } from './fakeHub';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('a new room that gets a code already in use picks another code', async () => {
  const hub = new Hub();
  (randomCode as Mock).mockReturnValueOnce('AAAA').mockReturnValueOnce('AAAA').mockReturnValueOnce('BBBB');

  const first = new Session(hub.connect);
  first.create('Asha');
  vi.advanceTimersByTime(CLAIM_MS);
  await flush();
  expect(first.view).toMatchObject({ stage: 'lobby', code: 'AAAA' });

  const second = new Session(hub.connect);
  second.create('Ravi');
  await flush();
  vi.advanceTimersByTime(CLAIM_MS); // sees someone already in AAAA, tries again
  await flush();
  vi.advanceTimersByTime(CLAIM_MS);
  await flush();
  expect(second.view).toMatchObject({ stage: 'lobby', code: 'BBBB' });
  expect(first.view).toMatchObject({ stage: 'lobby', code: 'AAAA', players: [{ name: 'Asha' }] });
});

import { describe, expect, it } from 'vitest';
import { APP_VERSION, GAME_NAME } from '../src/version';

// Phase 1: proves the tests run. Real tests come with phases 2 and 3.
describe('setup', () => {
  it('has the game name', () => {
    expect(GAME_NAME).toBe('Colour Rush');
  });

  it('has a version like 1.2.3', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

import { APP_VERSION, GAME_NAME } from '../version';
import { Logo } from './Logo';

// Phase 1 placeholder. The real screens come in phases 4 and 5.
export function App() {
  return (
    <div class="app">
      <div class="screen">
        <div class="home">
          <div class="hero">
            <Logo size="lg" />
            <h1>{GAME_NAME}</h1>
            <p class="tagline">
              A fast card game for 2 to 6 friends.
              <br />
              No sign up, no download.
            </p>
          </div>
          <div class="join-box center">
            <b>Coming soon</b>
            <p class="muted small" style={{ marginTop: '4px' }}>
              The game is being built. Check back later.
            </p>
          </div>
          <p class="muted small center">Version {APP_VERSION}</p>
        </div>
      </div>
    </div>
  );
}

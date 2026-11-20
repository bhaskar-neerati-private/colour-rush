// Small full-screen messages: creating, joining, could not find room, room closed, game coming next phase.
import type { ComponentChildren } from 'preact';
import type { PlayerView } from '../../network/session';
import { WifiOffIcon } from '../icons';
import { Logo } from '../Logo';
import { TopBar } from '../TopBar';

function Message({ room, children }: { room?: string; children: ComponentChildren }) {
  return (
    <div class="screen">
      <TopBar room={room} />
      <div class="center-msg">{children}</div>
    </div>
  );
}

export const Creating = ({ onCancel }: { onCancel: () => void }) => (
  <Message>
    <div class="spin lg" />
    <h2>Creating your room</h2>
    <p class="muted">Getting a room code...</p>
    <button class="btn" onClick={onCancel}>Cancel</button>
  </Message>
);

export const Joining = ({ code, onCancel }: { code: string; onCancel: () => void }) => (
  <Message>
    <div class="spin lg" />
    <h2>Joining room {code}</h2>
    <p class="muted">Connecting to the other players...</p>
    <button class="btn" onClick={onCancel}>Cancel</button>
  </Message>
);

export const NotFound = ({ code, onHome, onRetry }: { code: string; onHome: () => void; onRetry: () => void }) => (
  <Message>
    <div class="big-icon"><WifiOffIcon /></div>
    <h2>Could not find room {code}</h2>
    <p class="muted">Check the code. If the code is right, your network may be blocking the connection.</p>
    <div class="tip">
      <b>Tip:</b> Some office and mobile networks block direct connections between players. Try home Wi-Fi or a different network.
    </div>
    <div class="row">
      <button class="btn" onClick={onHome}>Back to home</button>
      <button class="btn primary" onClick={onRetry}>Try again</button>
    </div>
  </Message>
);

export const RoomClosed = ({ hostName, onHome }: { hostName: string; onHome: () => void }) => (
  <Message>
    <div class="big-icon"><WifiOffIcon /></div>
    <h2>{hostName} left</h2>
    <p class="muted">The host left, so this room is closed.</p>
    <button class="btn primary" onClick={onHome}>Back to home</button>
  </Message>
);

export const GameComingSoon = ({ code, players, onLeave }: { code: string; players: PlayerView[]; onLeave: () => void }) => (
  <Message room={code}>
    <Logo size="lg" />
    <h2>Everyone is in</h2>
    <p class="muted">
      {players.map((p) => p.name).join(', ')} are ready. The game screens come in the next build phase.
    </p>
    <button class="btn" onClick={onLeave}>Leave</button>
  </Message>
);

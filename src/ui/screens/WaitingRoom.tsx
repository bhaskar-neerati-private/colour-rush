// Waiting room: room code, Copy link, Share, the players, Start game (host) or waiting (others).
import type { PlayerView } from '../../network/session';
import { MAX_PLAYERS } from '../../network/lobby';
import { CopyIcon, ShareIcon } from '../icons';
import { TopBar } from '../TopBar';

interface Props {
  code: string;
  isHost: boolean;
  selfId: string;
  hostId: string;
  players: PlayerView[];
  onStart: () => void;
  onLeave: () => void;
  onCopy: () => void;
  onShare: () => void;
}

export function WaitingRoom({ code, isHost, selfId, hostId, players, onStart, onLeave, onCopy, onShare }: Props) {
  const count = players.length;
  const hostName = players.find((p) => p.id === hostId)?.name ?? 'the host';
  const openSeats = Array.from({ length: Math.max(0, MAX_PLAYERS - count) });

  return (
    <div class="screen">
      <TopBar right={<button class="btn sm ghost" onClick={onLeave}>Leave</button>} />
      <div class="lobby">
        <div class="code-box">
          <span class="label">Room code</span>
          <div class="code">{code}</div>
          <p class="muted small">Friends can join with this code or the link.</p>
          <div class="code-actions">
            <button class="btn sm" onClick={onCopy}><CopyIcon /> Copy link</button>
            <button class="btn sm" onClick={onShare}><ShareIcon /> Share</button>
          </div>
        </div>
        <div>
          <h3 class="sec">Players ({count} of {MAX_PLAYERS})</h3>
          <ul class="players">
            {players.map((p) => (
              <li class="player" key={p.id}>
                <div class="av">{p.name[0]?.toUpperCase()}</div>
                <span class="pname">
                  {p.name}
                  {p.id === selfId && <span class="you"> (you)</span>}
                </span>
                {p.id === hostId && <span class="tag host">Host</span>}
              </li>
            ))}
            {openSeats.map((_, i) => (
              <li class="player empty" key={`open-${i}`}>
                <div class="av empty" />
                <span>Open seat</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div class="footer">
        <div class="footer-in">
          {!isHost ? (
            <div class="waiting"><div class="spin" />Waiting for {hostName} to start the game</div>
          ) : count < 2 ? (
            <>
              <button class="btn primary block" disabled>Start game</button>
              <p class="hint">Share the code. You need at least 2 players to start.</p>
            </>
          ) : (
            <>
              <button class="btn primary block" onClick={onStart}>Start game ({count} players)</button>
              <p class="hint">More players can join until you start.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

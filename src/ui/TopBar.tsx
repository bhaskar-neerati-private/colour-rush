import type { ComponentChildren } from 'preact';
import { GAME_NAME } from '../version';
import { Logo } from './Logo';

export function TopBar({ room, right }: { room?: string; right?: ComponentChildren }) {
  return (
    <header class="topbar">
      <div class="brand"><Logo /><span>{GAME_NAME}</span></div>
      {room && <span class="room-pill">Room {room}</span>}
      <div class="sp" />
      {right}
    </header>
  );
}

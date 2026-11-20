// The real connection: Trystero, found through free public Nostr relays (docs/message-contract.md section 1).

import { joinRoom, type JsonValue } from 'trystero';
import type { Transport } from './transport';

export const APP_ID = 'colour-rush-v1';

export function trysteroTransport(code: string): Transport {
  // password: the room code encrypts the connection details, so only people with the code can connect.
  // identity 'none': a new identity per page, so a reloaded page is a new player (and tabs are separate players).
  const room = joinRoom({ appId: APP_ID, password: code, identity: 'none' }, code);
  const action = room.makeAction<JsonValue>('msg');
  return {
    send(data, to) {
      action.send(data as JsonValue, to ? { target: to } : undefined).catch(() => {
        // A peer that just left: nothing to do, the leave event handles it
      });
    },
    onMessage(handler) {
      action.onMessage((data, context) => handler(data, context.peerId));
    },
    onPeerJoin(handler) {
      room.onPeerJoin(({ peerId }) => handler(peerId));
    },
    onPeerLeave(handler) {
      room.onPeerLeave(({ peerId }) => handler(peerId));
    },
    leave() {
      void room.leave();
    },
  };
}

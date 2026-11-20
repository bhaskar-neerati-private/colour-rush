import { useEffect, useMemo, useState } from 'preact/hooks';
import { codeFromHash, inviteLink } from '../network/roomCode';
import { Session, type SessionView } from '../network/session';
import { trysteroTransport } from '../network/trystero';
import { GAME_NAME } from '../version';
import { RulesSheet } from './RulesSheet';
import { Home, loadName, refusedText } from './screens/Home';
import { Creating, GameComingSoon, Joining, NotFound, RoomClosed } from './screens/Messages';
import { WaitingRoom } from './screens/WaitingRoom';
import { SpeedTest } from './SpeedTest';

/** Shows the room code in the address bar, so a reload or a copied address goes back to Join. */
function setHash(code: string | null) {
  const url = `${location.pathname}${location.search}${code ? `#${code}` : ''}`;
  history.replaceState(null, '', url);
}

export function App() {
  if (new URLSearchParams(location.search).has('speedtest')) return <SpeedTest />;
  return <Game />;
}

function Game() {
  const session = useMemo(() => new Session(trysteroTransport), []);
  const [view, setView] = useState<SessionView>(session.view);
  const [rules, setRules] = useState(false);
  const [toast, setToast] = useState('');
  const [linkCode, setLinkCode] = useState(() => codeFromHash(location.hash));
  const [lastName, setLastName] = useState(loadName);

  useEffect(() => session.subscribe(setView), [session]);

  // Tell the others when the page closes
  useEffect(() => {
    const bye = () => session.leave();
    window.addEventListener('pagehide', bye);
    return () => window.removeEventListener('pagehide', bye);
  }, [session]);

  useEffect(() => {
    if (view.stage === 'lobby' || view.stage === 'started') {
      setHash(view.code);
      setLinkCode(null); // the invite link has been used
    }
    if (view.stage === 'home') setHash(null);
  }, [view]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const join = (code: string, name: string) => {
    setLastName(name);
    session.join(code, name);
  };
  const create = (name: string) => {
    setLastName(name);
    session.create(name);
  };

  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setToast('Link copied');
    } catch {
      setToast(`Room code: ${code}`);
    }
  };
  const share = async (code: string) => {
    const url = inviteLink(code);
    if (navigator.share) {
      try {
        await navigator.share({ title: GAME_NAME, text: `Join my ${GAME_NAME} game. Room code: ${code}`, url });
        return;
      } catch {
        return; // closed the share menu
      }
    }
    await copyLink(code);
  };

  let screen;
  switch (view.stage) {
    case 'home':
      screen = <Home code={linkCode ?? undefined} onCreate={create} onJoin={join} onRules={() => setRules(true)} />;
      break;
    case 'refused':
      screen = (
        <Home
          key={`refused-${view.reason}`}
          code={view.code}
          joinError={refusedText(view.reason, view.hostVersion)}
          onCreate={create}
          onJoin={join}
          onRules={() => setRules(true)}
        />
      );
      break;
    case 'creating':
      screen = <Creating onCancel={() => session.home()} />;
      break;
    case 'joining':
      screen = <Joining code={view.code} onCancel={() => session.home()} />;
      break;
    case 'notFound':
      screen = <NotFound code={view.code} onHome={() => session.home()} onRetry={() => join(view.code, lastName)} />;
      break;
    case 'closed':
      screen = <RoomClosed hostName={view.hostName} onHome={() => session.home()} />;
      break;
    case 'lobby':
      screen = (
        <WaitingRoom
          {...view}
          onStart={() => session.startGame()}
          onLeave={() => session.leave()}
          onCopy={() => copyLink(view.code)}
          onShare={() => share(view.code)}
        />
      );
      break;
    case 'started':
      screen = <GameComingSoon code={view.code} players={view.players} onLeave={() => session.leave()} />;
      break;
  }

  return (
    <div class="app">
      {screen}
      {rules && <RulesSheet onClose={() => setRules(false)} />}
      {toast && <div class="toast">{toast}</div>}
    </div>
  );
}

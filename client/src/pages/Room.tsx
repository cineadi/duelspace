import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { socket } from '../services/socket';
import { Copy, Check, Gamepad2 } from 'lucide-react';
import TicTacToe from '../components/TicTacToe';
import GuessDrawing from '../components/GuessDrawing';
import ChessGame from '../components/ChessGame';

interface Player {
  id: string;
  name: string;
}

export default function Room() {
  const { roomId } = useParams();
  const location = useLocation();
  const [players, setPlayers] = useState<Player[]>((location.state as any)?.players || []);
  const [copied, setCopied] = useState(false);
  const [activeGame, setActiveGame] = useState<string | null>(null);

  useEffect(() => {
    socket.emit('room:getPlayers', { roomCode: roomId });

    socket.on('room:updated', (data) => {
      setPlayers(data.players);
    });

    socket.on('room:gameStarted', ({ game }) => {
      setActiveGame(game);
    });

    return () => {
      socket.off('room:updated');
      socket.off('room:gameStarted');
    };
  }, [roomId]);

  const selectGame = (game: string) => {
    setActiveGame(game); // Opens locally immediately on click
    socket.emit('room:selectGame', { roomCode: roomId, game }); // Broadcasts to other player
  };

  const copyCode = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const gameButtonStyle = {
    padding: '24px',
    borderRadius: '12px',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.2)',
    background: '#1e293b',
    color: '#fff',
    textAlign: 'center' as const
  };

  return (
    <div style={{ maxWidth: activeGame ? '1150px' : '800px', margin: '0 auto', padding: '24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '24px', color: '#818cf8' }}>DUELSPACE</h1>

      {!activeGame ? (
        <div>
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', marginBottom: '24px' }}>
            <p style={{ color: '#94a3b8', margin: '0 0 8px 0', fontSize: '0.875rem' }}>ROOM CODE</p>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', letterSpacing: '4px', marginBottom: '12px' }}>{roomId}</div>
            <button
              onClick={copyCode}
              style={{ background: '#334155', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              {copied ? <Check size={18} color="#4ade80" /> : <Copy size={18} />}
              {copied ? 'Copied' : 'Copy Code'}
            </button>
          </div>

          <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-around', marginBottom: '32px' }}>
            {players.map((p) => (
              <div key={p.id}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: '1.5rem', fontWeight: 'bold' }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <span style={{ color: '#4ade80', fontSize: '0.75rem' }}>● Online</span>
              </div>
            ))}
          </div>

          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Gamepad2 /> Select a Game
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <button
              type="button"
              onClick={() => selectGame('tictactoe')}
              className="glass-panel"
              style={gameButtonStyle}
            >
              <h4 style={{ margin: '0 0 8px 0', fontSize: '1.25rem' }}>Tic Tac Toe</h4>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>Classic 3x3 turn duel</p>
            </button>

            <button
              type="button"
              onClick={() => selectGame('drawing')}
              className="glass-panel"
              style={gameButtonStyle}
            >
              <h4 style={{ margin: '0 0 8px 0', fontSize: '1.25rem' }}>Guess the Drawing</h4>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>Real-time drawing & guessing</p>
            </button>

            <button
              type="button"
              onClick={() => selectGame('chess')}
              className="glass-panel"
              style={{ ...gameButtonStyle, gridColumn: '1 / -1' }}
            >
              <h4 style={{ margin: '0 0 8px 0', fontSize: '1.25rem' }}>♞ Chess</h4>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>Full chess rules with smooth animations</p>
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            onClick={() => selectGame('')}
            style={{ marginBottom: '20px', background: '#334155', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
          >
            ← Back to Lobby
          </button>
          {activeGame === 'tictactoe' && <TicTacToe roomCode={roomId!} players={players} />}
          {activeGame === 'drawing' && <GuessDrawing roomCode={roomId!} players={players} />}
          {activeGame === 'chess' && <ChessGame roomCode={roomId!} />}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { socket } from '../services/socket';

interface Props {
  roomCode: string;
  players: { id: string; name: string }[];
}

export default function TicTacToe({ roomCode, players }: Props) {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<string>(players[0]?.id || '');
  const [winner, setWinner] = useState<string | null>(null);
  const [scores, setScores] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    socket.on('game:state', (state) => {
      setBoard(state.board);
      setTurn(state.turn);
      setWinner(state.winner);
      setScores(state.scores || {});
    });

    return () => {
      socket.off('game:state');
    };
  }, []);

  const handleClick = (index: number) => {
    if (board[index] || winner || turn !== socket.id) return;
    socket.emit('game:move', { roomCode, index });
  };

  const isMyTurn = turn === socket.id;
  const mySymbol = socket.id === players[0]?.id ? 'X' : 'O';

  return (
    <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', maxWidth: '400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <span>{players[0]?.name} (X): {scores[players[0]?.id] || 0}</span>
        <span>{players[1]?.name} (O): {scores[players[1]?.id] || 0}</span>
      </div>

      <div style={{ marginBottom: '16px', fontWeight: 'bold' }}>
        {winner ? (
          winner === 'draw' ? 'Draw game!' : `Winner: ${winner === mySymbol ? 'You!' : 'Opponent'}`
        ) : (
          <span style={{ color: isMyTurn ? '#4ade80' : '#facc15' }}>
            {isMyTurn ? `Your Turn (${mySymbol})` : "Opponent's Turn..."}
          </span>
        )}
      </div>

      <div className="ttt-grid">
        {board.map((val, idx) => (
          <button key={idx} className="ttt-cell" onClick={() => handleClick(idx)}>
            <span style={{ color: val === 'X' ? '#818cf8' : '#c084fc' }}>{val}</span>
          </button>
        ))}
      </div>

      {winner && (
        <button
          onClick={() => socket.emit('game:rematch', { roomCode })}
          style={{ marginTop: '16px', background: '#4f46e5', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
        >
          Play Again
        </button>
      )}
    </div>
  );
}
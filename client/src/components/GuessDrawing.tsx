import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../services/socket';
import { Send, Eraser, RotateCcw, Clock } from 'lucide-react';

interface Props {
  roomCode: string;
  players: { id: string; name: string; score?: number }[];
}

export default function GuessDrawing({ roomCode, players: propPlayers }: Props) {
  const [players, setPlayers] = useState(propPlayers);
  const [isDrawer, setIsDrawer] = useState(false);
  const [drawerName, setDrawerName] = useState('');
  const [secretWord, setSecretWord] = useState('');
  const [wordLength, setWordLength] = useState(0);
  const [wordChoices, setWordChoices] = useState<string[]>([]);
  const [timer, setTimer] = useState(60);
  const [guess, setGuess] = useState('');
  const [messages, setMessages] = useState<{ name: string; text: string; isCorrect?: boolean }[]>([]);

  // Palette and tools
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(4);
  const [isEraser, setIsEraser] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Register listeners BEFORE asking the server for the round state.
    const handlePickWord = (payload: any) => {
      // New round: forget the previous word
      setSecretWord('');
      setWordLength(0);

      const words = Array.isArray(payload?.words)
        ? payload.words
        : Array.isArray(payload)
          ? payload
          : [];

      const drawerId = payload?.drawerId;
      setDrawerName(payload?.drawerName || '');

      const amIDrawer = !!drawerId && socket.id === drawerId;
      setIsDrawer(amIDrawer);

      // Only the drawer gets the word picker.
      setWordChoices(amIDrawer ? words.filter(Boolean).map(String) : []);
    };

    const handleRoundActive = (data: any) => {
      setWordChoices([]);
      const amIDrawer = socket.id === data?.drawerId;
      setIsDrawer(amIDrawer);
      setDrawerName(data?.drawerName || '');
      setWordLength(Number(data?.wordLength || 0));
      setSecretWord(data?.word || '');
      if (data?.players) setPlayers(data.players);

      clearLocalCanvas();
      setMessages(prev => [
        ...prev,
        {
          name: 'SYSTEM',
          text: `Round started! ${data?.drawerName || 'The drawer'} is drawing.`
        }
      ]);
    };

    const handleTimer = ({ timer }: any) => {
      setTimer(Number(timer ?? 60));
    };

    const handleStroke = (stroke: any) => {
      if (!stroke) return;
      draw(
        Number(stroke.x0),
        Number(stroke.y0),
        Number(stroke.x1),
        Number(stroke.y1),
        stroke.color || '#000000',
        Number(stroke.width || 4),
        !!stroke.isEraser
      );
    };

    const handleClear = () => clearLocalCanvas();

    const handleCorrect = (data: any) => {
      setMessages(prev => [
        ...prev,
        {
          name: 'SYSTEM',
          text: `${data?.winnerName || 'Player'} correctly guessed "${data?.word || ''}"! (+100 pts)`,
          isCorrect: true
        }
      ]);
      if (data?.players) setPlayers(data.players);
    };

    const handleTimeUp = (data: any) => {
      setMessages(prev => [
        ...prev,
        {
          name: 'SYSTEM',
          text: `Time's up! The word was "${data?.word || 'unknown'}".`
        }
      ]);
      setIsDrawer(false);
      setWordChoices([]);
    };

    const handleMessage = (data: any) => {
      if (!data) return;
      setMessages(prev => [...prev, data]);
    };

    const handleRoomError = (e: any) => {
      setMessages(prev => [...prev, { name: 'SYSTEM', text: e?.message || 'Room error' }]);
    };

    socket.on('drawing:pickWord', handlePickWord);
    socket.on('drawing:roundActive', handleRoundActive);
    socket.on('drawing:timer', handleTimer);
    socket.on('drawing:stroke', handleStroke);
    socket.on('drawing:clear', handleClear);
    socket.on('drawing:correct', handleCorrect);
    socket.on('drawing:timeUp', handleTimeUp);
    socket.on('drawing:message', handleMessage);
    socket.on('room:error', handleRoomError);

    console.log('socket connected?', socket.connected, socket.id);

    // Ask the server for the current round state once the socket is connected.
    const startRound = () => {
      socket.emit('drawing:startRound', { roomCode });
    };

    if (socket.connected) {
      startRound();
    } else {
      socket.once('connect', startRound);
    }

    return () => {
      socket.off('drawing:pickWord', handlePickWord);
      socket.off('drawing:roundActive', handleRoundActive);
      socket.off('drawing:timer', handleTimer);
      socket.off('drawing:stroke', handleStroke);
      socket.off('drawing:clear', handleClear);
      socket.off('drawing:correct', handleCorrect);
      socket.off('drawing:timeUp', handleTimeUp);
      socket.off('drawing:message', handleMessage);
      socket.off('room:error', handleRoomError);
      socket.off('connect', startRound);
    };
  }, [roomCode]);

  const clearLocalCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const selectWord = (word: string) => {
    setWordChoices([]);
    setSecretWord(word);
    setWordLength(word.length);
    socket.emit('drawing:wordSelected', { roomCode, word });
  };

  const draw = (x0: number, y0: number, x1: number, y1: number, strokeColor: string, width: number, eraser: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = eraser ? '#ffffff' : strokeColor;
    ctx.lineWidth = eraser ? 24 : width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);

    isDrawing.current = true;
    lastPos.current = getCanvasCoords(e);

    // Draw a tiny dot so a click/tap is visible too.
    draw(
      lastPos.current.x,
      lastPos.current.y,
      lastPos.current.x + 0.01,
      lastPos.current.y + 0.01,
      color,
      lineWidth,
      isEraser
    );
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !isDrawer) return;

    e.preventDefault();
    const currentPos = getCanvasCoords(e);

    draw(
      lastPos.current.x,
      lastPos.current.y,
      currentPos.x,
      currentPos.y,
      color,
      lineWidth,
      isEraser
    );

    socket.emit('drawing:stroke', {
      roomCode,
      stroke: {
        x0: lastPos.current.x,
        y0: lastPos.current.y,
        x1: currentPos.x,
        y1: currentPos.y,
        color,
        width: lineWidth,
        isEraser
      }
    });

    lastPos.current = currentPos;
  };

  const stopDrawing = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawing.current = false;
    if (e) {
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      } catch {
        // Pointer capture may already have been released.
      }
    }
  };

  const clearCanvas = () => {
    if (!isDrawer) return;
    clearLocalCanvas();
    socket.emit('drawing:clear', { roomCode });
  };

  const submitGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || isDrawer) return;
    socket.emit('drawing:guess', { roomCode, guess });
    setGuess('');
  };

  const palette = [
    '#000000', '#ffffff', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#06b6d4', '#3b82f6',
    '#8b5cf6', '#ec4899', '#78350f', '#64748b'
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 280px', gap: '16px', maxWidth: '1100px', margin: '0 auto', textAlign: 'left', position: 'relative' }}>

      {/* 3-Word Selection Modal */}
      {isDrawer && wordChoices.length > 0 && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(2, 6, 23, 0.9)', backdropFilter: 'blur(8px)',
          zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '16px'
        }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '8px', color: '#fff' }}>Choose a Word to Draw</h2>
          <p style={{ color: '#94a3b8', marginBottom: '24px' }}>Select one of the words below:</p>
          <div style={{ display: 'flex', gap: '16px' }}>
            {wordChoices.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => selectWord(w)}
                style={{
                  padding: '16px 28px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '12px',
                  fontSize: '1.25rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)'
                }}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 1. Left Scoreboard */}
      <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', height: '560px', display: 'flex', flexDirection: 'column' }}>
        <h4 style={{ margin: '0 0 16px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>Leaderboard</h4>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {players.map((p, idx) => (
            <div key={p.id} style={{ background: drawerName === p.name ? '#1e1b4b' : '#0f172a', border: drawerName === p.name ? '1px solid #6366f1' : '1px solid #1e293b', padding: '12px', borderRadius: '8px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>#{idx + 1} {p.name}</span>
                {drawerName === p.name && <div style={{ fontSize: '0.75rem', color: '#818cf8' }}>Drawing</div>}
              </div>
              <span style={{ fontWeight: 'bold', color: '#4ade80' }}>{p.score || 0} pts</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Middle Game Canvas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="glass-panel" style={{ padding: '12px 20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: timer <= 15 ? '#ef4444' : '#facc15', fontWeight: 'bold' }}>
            <Clock size={20} /> <span>{timer}s</span>
          </div>

          <div style={{ fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center' }}>
            {isDrawer ? (
              <span>Your Word: <strong style={{ color: '#4ade80', letterSpacing: '2px', background: '#020617', padding: '4px 12px', borderRadius: '6px' }}>{secretWord || 'Pick a word!'}</strong></span>
            ) : (
              <span>Word: <strong style={{ letterSpacing: '6px', fontSize: '1.4rem', color: '#818cf8' }}>{wordLength > 0 ? '_ '.repeat(wordLength) : 'Waiting...'}</strong> ({wordLength} letters)</span>
            )}
          </div>

          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            {isDrawer ? 'You are Drawing!' : `${drawerName || 'Waiting'} is drawing`}
          </span>
        </div>

        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            cursor: isDrawer ? 'crosshair' : 'not-allowed',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            display: 'block',
            touchAction: 'none'
          }}
        />

        {/* Toolbar */}
        {isDrawer ? (
          <div className="glass-panel" style={{ padding: '10px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxWidth: '280px' }}>
              {palette.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setColor(c); setIsEraser(false); }}
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: c,
                    border: color === c && !isEraser ? '3px solid #6366f1' : '2px solid #334155',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[3, 6, 12].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setLineWidth(size)}
                    style={{
                      width: '32px', height: '32px', borderRadius: '8px', background: lineWidth === size ? '#4f46e5' : '#1e293b',
                      color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <div style={{ width: size, height: size, borderRadius: '50%', background: '#fff' }} />
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsEraser(!isEraser)}
                style={{ padding: '8px 12px', background: isEraser ? '#4f46e5' : '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}
                title="Eraser"
              >
                <Eraser size={16} />
              </button>

              <button
                type="button"
                onClick={clearCanvas}
                style={{ padding: '8px 12px', background: '#dc2626', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}
                title="Clear Board"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-panel" style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', padding: '12px', borderRadius: '12px' }}>
            <strong>{drawerName}</strong> is drawing. Enter your guess in the chat!
          </div>
        )}
      </div>

      {/* 3. Right Chat / Guessing Feed */}
      <div className="glass-panel" style={{ padding: '16px', borderRadius: '12px', height: '560px', display: 'flex', flexDirection: 'column' }}>
        <h4 style={{ margin: '0 0 12px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>Chat & Guesses</h4>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              fontSize: '0.875rem',
              color: m.isCorrect ? '#4ade80' : m.name === 'SYSTEM' ? '#818cf8' : '#e2e8f0',
              background: m.isCorrect ? 'rgba(74, 222, 128, 0.15)' : 'transparent',
              padding: '6px 8px', borderRadius: '6px'
            }}>
              <strong>{m.name}: </strong>{m.text}
            </div>
          ))}
        </div>

        {!isDrawer ? (
          <form onSubmit={submitGuess} style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder="Type your guess here..."
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              style={{ flex: 1, background: '#020617', border: '1px solid #334155', borderRadius: '8px', color: '#fff', padding: '10px 12px', fontSize: '0.875rem' }}
            />
            <button type="submit" style={{ background: '#4f46e5', border: 'none', borderRadius: '8px', color: '#fff', padding: '0 14px', cursor: 'pointer' }}>
              <Send size={16} />
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', padding: '8px', background: '#0f172a', borderRadius: '8px' }}>
            You are drawing. No guessing allowed!
          </div>
        )}
      </div>

    </div>
  );
}

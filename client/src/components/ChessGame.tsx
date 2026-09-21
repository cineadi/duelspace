import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { socket } from '../services/socket';

interface Props {
  roomCode: string;
}

interface LegalMove {
  to: string;
  promotion: boolean;
  capture: boolean;
}

interface ChessState {
  fen: string;
  turn: 'w' | 'b';
  white: { id: string | null; name: string | null };
  black: { id: string | null; name: string | null };
  lastMove: {
    from: string;
    to: string;
    san: string;
    color: 'w' | 'b';
    piece: string;
    captured: string | null;
    flags: string;
    promotion: string | null;
  } | null;
  moves: string[];
  moveCount: number;
  inCheck: boolean;
  status: 'waiting' | 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resigned';
  winner: 'w' | 'b' | null;
  reason: string;
  legalMoves: Record<string, LegalMove[]>;
  capturedByWhite: string[];
  capturedByBlack: string[];
}

const FILES = 'abcdefgh';
const TEXT_MODE = '\uFE0E'; // stops phones from turning pieces into emoji
const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const CSS = `
.chess-wrap { display:flex; gap:20px; justify-content:center; align-items:flex-start; flex-wrap:wrap; text-align:left; }
.chess-col { display:flex; flex-direction:column; gap:10px; }
.chess-board {
  position:relative; display:grid; grid-template-columns:repeat(8,1fr); grid-template-rows:repeat(8,1fr);
  width:min(calc(100vw - 56px), 560px); aspect-ratio:1;
  --sq:calc(min(calc(100vw - 56px), 560px) / 8);
  border-radius:10px; overflow:hidden; box-shadow:0 14px 44px rgba(0,0,0,.55);
  user-select:none; -webkit-user-select:none; touch-action:manipulation;
}
.chess-sq { position:relative; display:flex; align-items:center; justify-content:center; }
.chess-sq.light { background:#ebecd0; }
.chess-sq.dark { background:#779556; }
.chess-sq.clickable { cursor:pointer; }
.chess-hl { position:absolute; inset:0; pointer-events:none; }
.chess-last { background:rgba(255,235,59,.5); }
.chess-selected { background:rgba(20,85,30,.5); }
.chess-check {
  background:radial-gradient(ellipse at center, rgba(255,0,0,1) 0%, rgba(231,0,0,1) 25%, rgba(169,0,0,0) 89%, rgba(158,0,0,0) 100%);
  animation:chess-pulse 1.1s ease-in-out infinite;
}
@keyframes chess-pulse { 0%,100% { opacity:.75; } 50% { opacity:1; } }
.chess-coord { position:absolute; font-size:calc(var(--sq) * .17); font-weight:700; line-height:1; pointer-events:none; z-index:1; }
.chess-coord.rank { top:5%; left:6%; }
.chess-coord.file { bottom:4%; right:6%; }
.chess-sq.light .chess-coord { color:#779556; }
.chess-sq.dark .chess-coord { color:#ebecd0; }

.chess-piece { position:relative; z-index:2; width:100%; height:100%; display:flex; align-items:center; justify-content:center; pointer-events:none; }
.chess-piece.slide { z-index:6; animation:chess-slide .28s cubic-bezier(.2,.8,.2,1); }
.chess-piece.pop { animation:chess-pop .4s ease-out backwards; }
@keyframes chess-slide {
  from { transform:translate(calc(var(--dx) * 100%), calc(var(--dy) * 100%)); }
  to { transform:translate(0,0); }
}
@keyframes chess-pop { from { transform:scale(.4); opacity:0; } to { transform:scale(1); opacity:1; } }

.chess-glyph {
  font-size:calc(var(--sq) * .82); line-height:1; transition:transform .12s ease;
  font-family:"Segoe UI Symbol","Noto Sans Symbols 2","Apple Symbols","DejaVu Sans",sans-serif;
}
.chess-glyph.white {
  color:#fff; -webkit-text-stroke:calc(var(--sq) * .025) #1a1a1a;
  text-shadow:0 calc(var(--sq) * .03) calc(var(--sq) * .05) rgba(0,0,0,.45);
}
.chess-glyph.black {
  color:#1f1f1f; -webkit-text-stroke:calc(var(--sq) * .012) #000;
  text-shadow:0 calc(var(--sq) * .03) calc(var(--sq) * .05) rgba(0,0,0,.35);
}
.chess-sq.clickable:hover .chess-glyph { transform:scale(1.1); }

.chess-dot { position:absolute; width:32%; height:32%; border-radius:50%; background:rgba(0,0,0,.2); pointer-events:none; z-index:3; }
.chess-ring { position:absolute; inset:3%; border-radius:50%; box-shadow:inset 0 0 0 calc(var(--sq) * .09) rgba(0,0,0,.22); pointer-events:none; z-index:3; }

.chess-ghost { position:absolute; inset:0; z-index:4; display:flex; align-items:center; justify-content:center; pointer-events:none; animation:chess-ghost .45s ease-out forwards; }
@keyframes chess-ghost { from { opacity:1; transform:scale(1); } to { opacity:0; transform:scale(.4) rotate(14deg); } }

.chess-plate {
  display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 14px;
  border-radius:12px; background:#0f172a; border:1px solid #1e293b; transition:border-color .25s, box-shadow .25s;
  width:min(calc(100vw - 56px), 560px); box-sizing:border-box;
}
.chess-plate.active { border-color:#6366f1; box-shadow:0 0 0 2px rgba(99,102,241,.3), 0 0 18px rgba(99,102,241,.35); }
.chess-dotcolor { width:18px; height:18px; border-radius:50%; border:2px solid #475569; flex-shrink:0; }
.chess-mini { font-size:20px; line-height:1; font-family:"Segoe UI Symbol","Noto Sans Symbols 2","Apple Symbols","DejaVu Sans",sans-serif; }
.chess-mini.white { color:#fff; -webkit-text-stroke:.6px #1a1a1a; }
.chess-mini.black { color:#1f1f1f; }

.chess-side { width:min(calc(100vw - 56px), 300px); display:flex; flex-direction:column; gap:10px; }
.chess-status { padding:12px 14px; border-radius:12px; background:#0f172a; border:1px solid #1e293b; font-weight:700; text-align:center; }
.chess-status.mine { border-color:#22c55e; color:#4ade80; }
.chess-status.check { border-color:#ef4444; color:#f87171; }
.chess-moves { background:#0f172a; border:1px solid #1e293b; border-radius:12px; padding:10px 12px; height:260px; overflow-y:auto; font-size:.9rem; }
.chess-moverow { display:grid; grid-template-columns:32px 1fr 1fr; padding:3px 4px; border-radius:6px; color:#cbd5e1; }
.chess-moverow .n { color:#64748b; }
.chess-moverow .now { background:rgba(99,102,241,.35); border-radius:4px; color:#fff; padding:0 4px; }

.chess-btn { background:#4f46e5; color:#fff; border:none; border-radius:10px; padding:10px 16px; font-weight:700; cursor:pointer; transition:filter .15s, transform .1s; }
.chess-btn:hover { filter:brightness(1.15); }
.chess-btn:active { transform:scale(.97); }
.chess-btn.grey { background:#334155; }
.chess-btn.red { background:#dc2626; }

.chess-overlay { position:absolute; inset:0; z-index:20; display:flex; align-items:center; justify-content:center; background:rgba(2,6,23,.65); backdrop-filter:blur(3px); animation:chess-fade .3s ease-out; }
.chess-card { background:#0f172a; border:1px solid #334155; border-radius:16px; padding:22px 26px; text-align:center; color:#fff; min-width:220px; animation:chess-rise .4s cubic-bezier(.2,.9,.3,1.2); }
.chess-promo { background:#1e293b; border:2px solid #334155; border-radius:12px; padding:6px 10px; cursor:pointer; transition:transform .12s, border-color .12s; }
.chess-promo:hover { transform:translateY(-4px); border-color:#6366f1; }
@keyframes chess-fade { from { opacity:0; } to { opacity:1; } }
@keyframes chess-rise { from { transform:translateY(24px) scale(.9); opacity:0; } to { transform:none; opacity:1; } }
`;

function parseFen(fen: string): (string | null)[][] {
  const rows = fen.split(' ')[0].split('/');
  return rows.map(row => {
    const out: (string | null)[] = [];
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        for (let i = 0; i < Number(ch); i++) out.push(null);
      } else {
        out.push(ch);
      }
    }
    return out;
  });
}

function displayPos(square: string, flipped: boolean) {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  return {
    col: flipped ? 7 - file : file,
    row: flipped ? rank - 1 : 8 - rank
  };
}

function valueOf(pieces: string[]) {
  return pieces.reduce((sum, p) => sum + (VALUE[p] || 0), 0);
}

function Plate(props: {
  color: 'w' | 'b';
  name: string | null;
  isMe: boolean;
  active: boolean;
  captured: string[];
  advantage: number;
}) {
  const { color, name, isMe, active, captured, advantage } = props;
  const sorted = [...captured].sort((a, b) => (VALUE[b] || 0) - (VALUE[a] || 0));
  return (
    <div className={`chess-plate${active ? ' active' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <div className="chess-dotcolor" style={{ background: color === 'w' ? '#f8fafc' : '#0b1220' }} />
        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name || 'Waiting…'}
        </strong>
        {isMe && <span style={{ color: '#94a3b8', fontSize: '.8rem' }}>(you)</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <span style={{ display: 'flex', gap: '1px' }}>
          {sorted.map((p, i) => (
            <span key={i} className={`chess-mini ${color === 'w' ? 'black' : 'white'}`}>
              {GLYPH[p] + TEXT_MODE}
            </span>
          ))}
        </span>
        {advantage > 0 && <span style={{ color: '#94a3b8', fontSize: '.85rem', fontWeight: 700 }}>+{advantage}</span>}
      </div>
    </div>
  );
}

export default function ChessGame({ roomCode }: Props) {
  const [state, setState] = useState<ChessState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [animateMove, setAnimateMove] = useState(false);
  const [showOver, setShowOver] = useState(true);
  const [error, setError] = useState('');

  const prevCount = useRef<number | null>(null);
  const prevStatus = useRef('');
  const moveListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onState = (s: ChessState) => {
      // Slide animation only when exactly one new move arrived
      const animate = prevCount.current !== null && s.moveCount === prevCount.current + 1;
      prevCount.current = s.moveCount;
      setAnimateMove(animate);
      if (s.status !== prevStatus.current) setShowOver(true);
      prevStatus.current = s.status;
      setState(s);
      setSelected(null);
      setPendingPromotion(null);
    };
    const onError = (e: { message?: string }) => setError(e?.message || 'Something went wrong');

    socket.on('chess:state', onState);
    socket.on('room:error', onError);

    const join = () => socket.emit('chess:join', { roomCode });
    if (socket.connected) join();
    else socket.once('connect', join);

    return () => {
      socket.off('chess:state', onState);
      socket.off('room:error', onError);
      socket.off('connect', join);
    };
  }, [roomCode]);

  // Keep the move list scrolled to the newest move
  useEffect(() => {
    const el = moveListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state?.moveCount]);

  if (!state) {
    return (
      <div className="glass-panel" style={{ padding: '24px', borderRadius: '12px', color: '#94a3b8' }}>
        {error || 'Loading chess board…'}
      </div>
    );
  }

  const myColor: 'w' | 'b' | null =
    state.white.id === socket.id ? 'w' : state.black.id === socket.id ? 'b' : null;
  const bottomColor: 'w' | 'b' = myColor ?? 'w';
  const topColor: 'w' | 'b' = bottomColor === 'w' ? 'b' : 'w';
  const flipped = bottomColor === 'b';

  const board = parseFen(state.fen);
  const myTurn = state.status === 'playing' && myColor !== null && state.turn === myColor;
  const legalTargets: LegalMove[] = selected && myTurn ? state.legalMoves[selected] || [] : [];
  const last = state.lastMove;
  const isOver =
    state.status === 'checkmate' ||
    state.status === 'stalemate' ||
    state.status === 'draw' ||
    state.status === 'resigned';

  // Find the king that is in check (for the red glow)
  let checkSquare: string | null = null;
  if (state.inCheck) {
    const kingChar = state.turn === 'w' ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] === kingChar) checkSquare = FILES[c] + (8 - r);
      }
    }
  }

  // Work out the animations for the newest move
  let slideTo: string | null = null;
  let slideDx = 0;
  let slideDy = 0;
  let rookTo: string | null = null;
  let rookDx = 0;
  let ghost: { square: string; type: string; color: 'w' | 'b' } | null = null;
  if (animateMove && last) {
    const a = displayPos(last.from, flipped);
    const b = displayPos(last.to, flipped);
    slideTo = last.to;
    slideDx = a.col - b.col;
    slideDy = a.row - b.row;

    const kingSide = last.flags.includes('k');
    const queenSide = last.flags.includes('q');
    if (kingSide || queenSide) {
      const rank = last.color === 'w' ? '1' : '8';
      const rookFrom = (kingSide ? 'h' : 'a') + rank;
      const rookDest = (kingSide ? 'f' : 'd') + rank;
      rookTo = rookDest;
      rookDx = displayPos(rookFrom, flipped).col - displayPos(rookDest, flipped).col;
    }
    if (last.captured) {
      const capSquare = last.flags.includes('e') ? last.to[0] + last.from[1] : last.to;
      ghost = { square: capSquare, type: last.captured, color: last.color === 'w' ? 'b' : 'w' };
    }
  }

  const whiteAdvantage = valueOf(state.capturedByWhite) - valueOf(state.capturedByBlack);

  const onSquareClick = (square: string, piece: string | null) => {
    if (!myTurn || pendingPromotion) return;

    if (selected) {
      const target = (state.legalMoves[selected] || []).find(m => m.to === square);
      if (target) {
        if (target.promotion) {
          setPendingPromotion({ from: selected, to: square });
          return;
        }
        socket.emit('chess:move', { roomCode, from: selected, to: square });
        setSelected(null);
        return;
      }
    }

    const isMine = piece !== null && (piece === piece.toUpperCase() ? 'w' : 'b') === myColor;
    if (isMine && state.legalMoves[square]) setSelected(square === selected ? null : square);
    else setSelected(null);
  };

  const choosePromotion = (p: string) => {
    if (!pendingPromotion) return;
    socket.emit('chess:move', { roomCode, from: pendingPromotion.from, to: pendingPromotion.to, promotion: p });
    setPendingPromotion(null);
    setSelected(null);
  };

  const resign = () => {
    if (window.confirm('Do you want to resign?')) socket.emit('chess:resign', { roomCode });
  };
  const rematch = () => socket.emit('chess:rematch', { roomCode });

  // Text shown in the status box
  let statusText = '';
  if (state.status === 'waiting') {
    statusText = state.moveCount > 0 ? 'Opponent disconnected' : 'Waiting for opponent…';
  } else if (state.status === 'playing') {
    if (myColor === null) statusText = `${state.turn === 'w' ? 'White' : 'Black'} to move`;
    else if (myTurn) statusText = state.inCheck ? 'Check! Your move' : 'Your move';
    else statusText = 'Opponent is thinking…';
  } else {
    statusText = state.reason;
  }

  let overTitle = '';
  if (isOver) {
    if (state.winner === null) overTitle = 'Draw';
    else if (myColor === null) overTitle = state.winner === 'w' ? 'White wins' : 'Black wins';
    else overTitle = state.winner === myColor ? 'You won! 🎉' : 'You lost';
  }

  const rows: { n: number; w: string; b?: string; wi: number }[] = [];
  for (let i = 0; i < state.moves.length; i += 2) {
    rows.push({ n: i / 2 + 1, w: state.moves[i], b: state.moves[i + 1], wi: i });
  }

  const idx = [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="chess-wrap">
      <style>{CSS}</style>

      {/* Board column */}
      <div className="chess-col">
        <Plate
          color={topColor}
          name={topColor === 'w' ? state.white.name : state.black.name}
          isMe={myColor === topColor}
          active={state.status === 'playing' && state.turn === topColor}
          captured={topColor === 'w' ? state.capturedByWhite : state.capturedByBlack}
          advantage={topColor === 'w' ? whiteAdvantage : -whiteAdvantage}
        />

        <div className="chess-board">
          {idx.map(dr =>
            idx.map(dc => {
              const r = flipped ? 7 - dr : dr;
              const c = flipped ? 7 - dc : dc;
              const square = FILES[c] + (8 - r);
              const piece = board[r][c];
              const isLight = (r + c) % 2 === 0;
              const target = legalTargets.find(m => m.to === square);
              const isMine =
                piece !== null && (piece === piece.toUpperCase() ? 'w' : 'b') === myColor;
              const clickable = myTurn && (!!target || (isMine && !!state.legalMoves[square]));

              const isSlide = animateMove && slideTo === square;
              const isRook = animateMove && rookTo === square;
              const popIn = state.moveCount === 0 && !animateMove;
              const pieceKey = isSlide || isRook ? `${square}-${piece}-${state.moveCount}` : `${square}-${piece}`;

              let pieceStyle: CSSProperties | undefined;
              if (isSlide) pieceStyle = { '--dx': slideDx, '--dy': slideDy } as CSSProperties;
              else if (isRook) pieceStyle = { '--dx': rookDx, '--dy': 0 } as CSSProperties;
              else if (popIn) pieceStyle = { animationDelay: `${dc * 35}ms` };

              return (
                <div
                  key={square}
                  className={`chess-sq ${isLight ? 'light' : 'dark'}${clickable ? ' clickable' : ''}`}
                  onClick={() => onSquareClick(square, piece)}
                >
                  {last && (last.from === square || last.to === square) && <div className="chess-hl chess-last" />}
                  {selected === square && <div className="chess-hl chess-selected" />}
                  {checkSquare === square && <div className="chess-hl chess-check" />}

                  {dc === 0 && <span className="chess-coord rank">{8 - r}</span>}
                  {dr === 7 && <span className="chess-coord file">{FILES[c]}</span>}

                  {ghost && ghost.square === square && (
                    <div key={`ghost-${state.moveCount}`} className="chess-ghost">
                      <span className={`chess-glyph ${ghost.color === 'w' ? 'white' : 'black'}`}>
                        {GLYPH[ghost.type] + TEXT_MODE}
                      </span>
                    </div>
                  )}

                  {piece && (
                    <div
                      key={pieceKey}
                      className={`chess-piece${isSlide || isRook ? ' slide' : ''}${popIn ? ' pop' : ''}`}
                      style={pieceStyle}
                    >
                      <span className={`chess-glyph ${piece === piece.toUpperCase() ? 'white' : 'black'}`}>
                        {GLYPH[piece.toLowerCase()] + TEXT_MODE}
                      </span>
                    </div>
                  )}

                  {target && (target.capture ? <div className="chess-ring" /> : <div className="chess-dot" />)}
                </div>
              );
            })
          )}

          {/* Promotion picker */}
          {pendingPromotion && myColor && (
            <div
              className="chess-overlay"
              onClick={() => {
                setPendingPromotion(null);
                setSelected(null);
              }}
            >
              <div className="chess-card" onClick={e => e.stopPropagation()}>
                <div style={{ fontWeight: 700, marginBottom: '12px' }}>Promote to</div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {['q', 'r', 'b', 'n'].map(p => (
                    <button key={p} type="button" className="chess-promo" onClick={() => choosePromotion(p)}>
                      <span
                        className={`chess-glyph ${myColor === 'w' ? 'white' : 'black'}`}
                        style={{ fontSize: '44px' }}
                      >
                        {GLYPH[p] + TEXT_MODE}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Game over card */}
          {isOver && showOver && (
            <div className="chess-overlay">
              <div className="chess-card">
                <div style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '4px' }}>{overTitle}</div>
                <div style={{ color: '#94a3b8', marginBottom: '18px' }}>{state.reason}</div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  {myColor !== null && (
                    <button type="button" className="chess-btn" onClick={rematch}>
                      Rematch
                    </button>
                  )}
                  <button type="button" className="chess-btn grey" onClick={() => setShowOver(false)}>
                    View board
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <Plate
          color={bottomColor}
          name={bottomColor === 'w' ? state.white.name : state.black.name}
          isMe={myColor === bottomColor}
          active={state.status === 'playing' && state.turn === bottomColor}
          captured={bottomColor === 'w' ? state.capturedByWhite : state.capturedByBlack}
          advantage={bottomColor === 'w' ? whiteAdvantage : -whiteAdvantage}
        />
      </div>

      {/* Side panel */}
      <div className="chess-side">
        <div className={`chess-status${myTurn ? (state.inCheck ? ' check' : ' mine') : ''}`}>{statusText}</div>

        <div className="chess-moves" ref={moveListRef}>
          {rows.length === 0 && <div style={{ color: '#64748b' }}>Moves will show up here.</div>}
          {rows.map(row => (
            <div key={row.n} className="chess-moverow">
              <span className="n">{row.n}.</span>
              <span>
                <span className={state.moveCount - 1 === row.wi ? 'now' : ''}>{row.w}</span>
              </span>
              <span>
                {row.b && <span className={state.moveCount - 1 === row.wi + 1 ? 'now' : ''}>{row.b}</span>}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {state.status === 'playing' && myColor !== null && (
            <button type="button" className="chess-btn red" style={{ flex: 1 }} onClick={resign}>
              Resign
            </button>
          )}
          {isOver && myColor !== null && (
            <button type="button" className="chess-btn" style={{ flex: 1 }} onClick={rematch}>
              Rematch
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

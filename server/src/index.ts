import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

// Open http://localhost:4000/version in the browser to check which server code is running
app.get('/version', (_req, res) => {
  res.send('v2 - word picker is installed');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

interface Player {
  id: string;
  name: string;
  score: number;
}

interface Room {
  code: string;
  players: Player[];
  activeGame: string | null;
  gameState: {
    board: (string | null)[];
    turn: string;
    winner: string | null;
    scores: { [id: string]: number };
  };
  drawingState: {
    drawerId: string | null;
    drawerName: string;
    word: string;
    wordLength: number;
    timer: number;
    phase: 'idle' | 'picking' | 'drawing' | 'between';
    choices: string[];
    intervalId?: any;
  };
}

const rooms = new Map<string, Room>();

const WORD_BANK = [
  'PIZZA', 'APPLE', 'HOUSE', 'CAR', 'CAT', 'DOG', 'SUN', 'TREE', 'BOAT',
  'PLANE', 'GUITAR', 'CLOCK', 'FISH', 'STAR', 'ROCKET', 'BURGER',
  'CAMERA', 'BIKE', 'PENCIL', 'BALL', 'BIRD', 'CHAIR', 'MOON', 'BOOK'
];

function getRandomWords(count = 3): string[] {
  return [...WORD_BANK].sort(() => Math.random() - 0.5).slice(0, count);
}

function freshDrawingState(): Room['drawingState'] {
  return {
    drawerId: null,
    drawerName: '',
    word: '',
    wordLength: 0,
    timer: 60,
    phase: 'idle',
    choices: []
  };
}

// ---------- Drawing game helpers ----------

// Tell one socket a word is being picked. Only the drawer receives the words.
function sendPickWord(code: string, targetId: string) {
  const room = rooms.get(code);
  if (!room) return;
  const s = room.drawingState;
  io.to(targetId).emit('drawing:pickWord', {
    drawerId: s.drawerId,
    drawerName: s.drawerName,
    words: targetId === s.drawerId ? s.choices : []
  });
}

// Tell one socket the round is live. Only the drawer receives the real word.
function sendRoundActive(code: string, targetId: string) {
  const room = rooms.get(code);
  if (!room) return;
  const s = room.drawingState;
  const isDrawer = targetId === s.drawerId;
  io.to(targetId).emit('drawing:roundActive', {
    isDrawer,
    drawerId: s.drawerId,
    drawerName: s.drawerName,
    wordLength: s.wordLength,
    word: isDrawer ? s.word : null,
    players: room.players
  });
}

function startDrawingRound(roomCode: string) {
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room || room.players.length === 0) return;

  if (room.drawingState.intervalId) {
    clearInterval(room.drawingState.intervalId);
  }

  // Rotate drawer
  const currentIdx = room.players.findIndex(p => p.id === room.drawingState.drawerId);
  const nextDrawer = room.players[(currentIdx + 1) % room.players.length];
  console.log('round started, drawer:', nextDrawer.name);

  room.drawingState = {
    drawerId: nextDrawer.id,
    drawerName: nextDrawer.name,
    word: '',
    wordLength: 0,
    timer: 60,
    phase: 'picking',
    choices: getRandomWords(3)
  };

  io.to(code).emit('drawing:clear');
  room.players.forEach(p => sendPickWord(code, p.id));
}

function startRoundTimer(roomCode: string) {
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room) return;

  if (room.drawingState.intervalId) clearInterval(room.drawingState.intervalId);

  room.drawingState.timer = 60;
  io.to(code).emit('drawing:timer', { timer: room.drawingState.timer });

  room.drawingState.intervalId = setInterval(() => {
    if (!rooms.has(code)) {
      clearInterval(room.drawingState.intervalId);
      return;
    }
    room.drawingState.timer -= 1;
    io.to(code).emit('drawing:timer', { timer: room.drawingState.timer });

    if (room.drawingState.timer <= 0) {
      clearInterval(room.drawingState.intervalId);
      room.drawingState.phase = 'between';
      io.to(code).emit('drawing:timeUp', { word: room.drawingState.word });
      setTimeout(() => startDrawingRound(code), 3000);
    }
  }, 1000);
}

// ---------- Socket events ----------

io.on('connection', (socket) => {
  socket.on('room:create', ({ playerName }) => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    const newRoom: Room = {
      code,
      players: [{ id: socket.id, name: playerName || 'Player 1', score: 0 }],
      activeGame: null,
      gameState: { board: Array(9).fill(null), turn: socket.id, winner: null, scores: {} },
      drawingState: freshDrawingState()
    };
    rooms.set(code, newRoom);
    socket.join(code);
    socket.emit('room:created', { roomCode: code, players: newRoom.players });
  });

  socket.on('room:join', ({ roomCode, playerName }) => {
    const code = roomCode?.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return socket.emit('room:error', { message: 'Room not found' });

    const existingIndex = room.players.findIndex(p => p.id === socket.id);
    if (existingIndex !== -1) {
      room.players[existingIndex].name = playerName || room.players[existingIndex].name;
      socket.join(code);
      socket.emit('room:joined', { roomCode: code, players: room.players });
      io.to(code).emit('room:updated', { players: room.players });
      return;
    }

    if (room.players.length >= 2) {
      return socket.emit('room:error', { message: 'Room is already full' });
    }

    room.players.push({ id: socket.id, name: playerName || 'Player 2', score: 0 });
    socket.join(code);

    io.to(code).emit('room:updated', { players: room.players });
    socket.emit('room:joined', { roomCode: code, players: room.players });
  });

  socket.on('room:getPlayers', ({ roomCode }) => {
    const code = roomCode?.trim().toUpperCase();
    const room = rooms.get(code);
    if (room) {
      socket.join(code);
      socket.emit('room:updated', { players: room.players });
    }
  });

  socket.on('room:selectGame', ({ roomCode, game }) => {
    const code = roomCode?.trim().toUpperCase();
    const room = rooms.get(code);
    console.log('selectGame', code, game, 'roomFound:', !!room);
    if (!room) return socket.emit('room:error', { message: 'Room not found. Create a new room.' });

    room.activeGame = game;

    // Leaving the drawing game (Back to Lobby): stop its timer and reset it.
    if (game !== 'drawing') {
      if (room.drawingState.intervalId) clearInterval(room.drawingState.intervalId);
      room.drawingState = freshDrawingState();
    }

    io.to(code).emit('room:gameStarted', { game });

    if (game === 'drawing') {
      startDrawingRound(code);
    }
  });

  // ---------- Drawing game ----------

  // Called when a GuessDrawing component mounts. Re-sends the current state so
  // a player never misses the round-start event.
  socket.on('drawing:startRound', ({ roomCode }) => {
    const code = roomCode?.trim().toUpperCase();
    socket.join(code);
    const room = rooms.get(code);
    console.log('startRound', code, 'roomFound:', !!room, 'phase:', room?.drawingState.phase);
    if (!room) return socket.emit('room:error', { message: 'Room not found. Create a new room.' });

    const phase = room.drawingState.phase;
    if (phase === 'idle') {
      startDrawingRound(code);
    } else if (phase === 'picking') {
      sendPickWord(code, socket.id);
    } else if (phase === 'drawing') {
      sendRoundActive(code, socket.id);
    }
  });

  // The drawer clicked one of the 3 words.
  socket.on('drawing:wordSelected', ({ roomCode, word }) => {
    const code = roomCode?.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return;

    const s = room.drawingState;
    if (s.phase !== 'picking' || socket.id !== s.drawerId) return;
    if (!s.choices.includes(word)) return;

    s.word = word;
    s.wordLength = word.length;
    s.phase = 'drawing';

    room.players.forEach(p => sendRoundActive(code, p.id));
    startRoundTimer(code);
  });

  socket.on('drawing:stroke', ({ roomCode, stroke }) => {
    const code = roomCode?.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room || socket.id !== room.drawingState.drawerId) return; // only the drawer can draw
    socket.to(code).emit('drawing:stroke', stroke);
  });

  socket.on('drawing:clear', ({ roomCode }) => {
    const code = roomCode?.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room || socket.id !== room.drawingState.drawerId) return;
    io.to(code).emit('drawing:clear');
  });

  socket.on('drawing:guess', ({ roomCode, guess }) => {
    const code = roomCode?.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room || typeof guess !== 'string') return;
    if (room.drawingState.phase !== 'drawing') return; // no guessing before the word is picked

    const player = room.players.find(p => p.id === socket.id);
    if (!player || socket.id === room.drawingState.drawerId) return;

    const cleanGuess = guess.trim().toUpperCase();
    if (cleanGuess === room.drawingState.word) {
      player.score += 100;
      const drawer = room.players.find(p => p.id === room.drawingState.drawerId);
      if (drawer) drawer.score += 50;

      if (room.drawingState.intervalId) clearInterval(room.drawingState.intervalId);
      room.drawingState.phase = 'between';

      io.to(code).emit('drawing:correct', {
        winnerName: player.name,
        word: room.drawingState.word,
        players: room.players
      });

      setTimeout(() => startDrawingRound(code), 3000);
    } else {
      io.to(code).emit('drawing:message', {
        name: player.name,
        text: guess,
        isCorrect: false
      });
    }
  });

  // ---------- Tic Tac Toe ----------

  socket.on('game:move', ({ roomCode, index }) => {
    const code = roomCode?.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room || room.gameState.winner || room.gameState.board[index] !== null) return;
    if (room.gameState.turn !== socket.id) return;

    const symbol = socket.id === room.players[0].id ? 'X' : 'O';
    room.gameState.board[index] = symbol;

    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    let winResult: string | null = null;
    for (const [x, y, z] of lines) {
      if (room.gameState.board[x] && room.gameState.board[x] === room.gameState.board[y] && room.gameState.board[x] === room.gameState.board[z]) {
        winResult = room.gameState.board[x];
        break;
      }
    }
    if (!winResult && room.gameState.board.every(c => c !== null)) winResult = 'draw';

    if (winResult) {
      room.gameState.winner = winResult;
      if (winResult !== 'draw') {
        const winId = winResult === 'X' ? room.players[0].id : room.players[1].id;
        room.gameState.scores[winId] = (room.gameState.scores[winId] || 0) + 1;
      }
    } else {
      room.gameState.turn = room.players.find(p => p.id !== socket.id)!.id;
    }
    io.to(code).emit('game:state', room.gameState);
  });

  socket.on('game:rematch', ({ roomCode }) => {
    const code = roomCode?.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return;
    room.gameState.board = Array(9).fill(null);
    room.gameState.winner = null;
    room.gameState.turn = room.players[0].id;
    io.to(code).emit('game:state', room.gameState);
  });

  // ---------- Disconnect ----------

  socket.on('disconnect', () => {
    rooms.forEach((room, code) => {
      if (!room.players.some(p => p.id === socket.id)) return;

      const wasDrawer = room.drawingState.drawerId === socket.id;
      room.players = room.players.filter(p => p.id !== socket.id);

      if (room.players.length === 0) {
        if (room.drawingState.intervalId) clearInterval(room.drawingState.intervalId);
        rooms.delete(code);
        return;
      }

      io.to(code).emit('room:updated', { players: room.players });

      // If the drawer left mid-game, move on to the next drawer.
      if (wasDrawer && room.activeGame === 'drawing' && room.drawingState.phase !== 'idle') {
        startDrawingRound(code);
      }
    });
  });
});

// Online hosts (like Render) give us the port. On your own computer it uses 4000.
const PORT = Number(process.env.PORT) || 4000;
server.listen(PORT, () => console.log(`Server v2 running on port ${PORT}`));
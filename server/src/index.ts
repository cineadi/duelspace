import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Chess } from 'chess.js';

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

interface ChessRoom {
  game: Chess;
  whiteId: string | null;
  blackId: string | null;
  resigned: 'w' | 'b' | null; // who resigned (if anyone)
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
  chess?: ChessRoom;
}

const rooms = new Map<string, Room>();

const WORD_BANK = [
  'PIZZA', 'APPLE', 'HOUSE', 'CAR', 'CAT', 'DOG', 'SUN', 'TREE', 'BOAT',
  'PLANE', 'GUITAR', 'CLOCK', 'FISH', 'STAR', 'ROCKET', 'BURGER',
  'CAMERA', 'BIKE', 'PENCIL', 'BALL', 'BIRD', 'CHAIR', 'MOON', 'BOOK'
  ,'TREASURE', 'ASTRONAUT TRAINING', 'CAT', 'SEESAW', 'JEALOUSY', 'BURP',
  'CATERPILLAR', 'FLUTE', 'GRAVITY', 'CHEF', 'GHOST', 'SHIELD', 'ANATOMY'
  , 'SUN', 'APOLOGY', 'SPATULA', 'FREEFALL', 'KEY', 'SADDLE', 'BURGLARY'
  , 'LADDER', 'DNA STRAND', 'PANDA', 'HOURGLASS', 'LADYBUG', 'SHOVE', 'CHAOS'
  , 'MIRROR', 'SHOE', 'RIPPLE EFFECT', 'DRAGON', 'PUPPET', 'FAST FORWARD'
  , 'EAGLE', 'CRAMP', 'BOOMERANG', 'BICYCLE', 'MICROSCOPE', 'RAIN', 'MUSHROOM'
  , 'CAR', 'DENT', 'HEARTBEAT', 'FOSSIL FUEL', 'PIRATE', 'POPCORN', 'SLINGSHOT'
  , 'HITCHHIKER', 'SOCKS', 'CANDLE', 'CHECKMATE', 'WHALE', 'BACKFIRE', 'CHEESE'
  , 'BEE', 'DREAMLAND', 'CHAIR', 'BALLOON', 'SNAKE', 'SPONGE', 'BETRAYAL', 'REINDEER'
  , 'GLITCH', 'DOG', 'FURNITURE', 'TELESCOPE', 'KANGAROO', 'ECLIPSE', 'SHARK'
  , 'BUBBLE', 'MOUSTACHE', 'AMNESIA', 'FLOWER', 'FENCE', 'GOLF', 'HYPNOSIS'
  , 'EGG', 'CROWDED', 'BRUSH', 'CROSSWORD', 'CHERRY', 'NOSTALGIA', 'ROBOT'
  , 'FIREWORKS', 'DOOR', 'DIPLOMAT', 'MONKEY', 'PILLOW', 'TIME MACHINE'
  , 'ICEBERG', 'SHADOW PUPPET', 'CRAWL SPACE', 'TOASTER', 'PIZZA', 'DUCK'
  , 'CORRUPTION', 'PENCIL', 'SANDWICH', 'EXCLUSION', 'ISLAND', 'FROST', 'PUDDLE'
  , 'LION', 'ANESTHESIA', 'SKATEBOARD', 'AIRPLANE', 'CREEP', 'SATELLITE'
  , 'COINCIDENCE', 'IGLOO', 'BREAD', 'BLINDFOLD', 'RADAR', 'TREE', 'GUILTY'
  , 'FOOTPRINT', 'BARBECUE', 'BONE', 'DAYDREAM', 'MICROWAVE', 'CRAB', 'SWORD'
  , 'TOOTHBRUSH', 'SUBMARINE', 'OCTOPUS', 'CACTUS', 'CAMPFIRE', 'CHOREOGRAPHY'
  , 'BLENDER', 'STAPLER', 'PENGUIN', 'SPIDER', 'ROPE', 'NIGHTMARE', 'TRAFFIC LIGHT'
  , 'SPOON', 'COW', 'BEACH', 'FORESHADOWING', 'JINX', 'KETTLE', 'PARACHUTE'
  , 'LOCK', 'ANXIETY', 'BATTERY', 'INSPECTION', 'TICKET', 'SKELETON', 'FROSTBITE'
  , 'SCISSORS', 'STAMP', 'SNOWMAN', 'HELMET', 'POSTCARD', 'POLLUTION', 'DEPRESSION'
  , 'DRY ICE', 'PEANUT', 'BULLDOZER', 'JIGSAW', 'AEROBICS', 'BOREDOM', 'GLASS'
  , 'PLUMBER', 'INVISIBILITY', 'COWBOY', 'TRUMPET', 'CLOVER', 'GOSSIP', 'BUSH'
  , 'HURRICANE', 'FARM', 'UNDERCOVER', 'BASEBALL', 'STETHOSCOPE', 'CRAYON'
  , 'TRUCK', 'GUITAR', 'FORK', 'EVAPORATION', 'HAIL', 'CELLPHONE', 'CHIMNEY'
  , 'WAGON', 'VIRTUAL REALITY', 'SMILE', 'SINK', 'FROZEN', 'ARCHAEOLOGY'
  , 'BLACKSMITH', 'SNAIL', 'LEMON', 'BOOBY TRAP', 'SWAN', 'HEADPHONES', 'BACKFLIP'
  , 'COMPASS', 'COFFIN', 'PUMP', 'CUP', 'HOTDOG', 'EAVESDROP', 'FUGITIVE', 'SCREWDRIVER'
  , 'DIAMOND', 'CORN MAZE', 'SEAL', 'CLIMAX', 'BRIDGE', 'GRIEF', 'CLAW', 'SURFING'
  , 'MIRAGE', 'JELLYFISH', 'MOCKINGBIRD', 'SCORPION', 'LIPSTICK', 'BED'
  , 'POCKET', 'FLAG', 'AFTERLIFE', 'CHESS', 'CENSORED', 'BRICK', 'CARPOOL'
  , 'MAP', 'CLOWN', 'DOGHOUSE', 'RADIO', 'BUTTERFLY', 'BASKETBALL', 'CANOE'
  , 'MINT', 'MUSEUM', 'CHALK', 'TENT', 'TURBULENCE', 'ZERO GRAVITY', 'BLIZZARD'
  , 'HICCUP', 'BROKEN HEART', 'DESERT', 'BARN', 'SCARF', 'KNIFE', 'MELTDOWN', 'RACKET'
  , 'TOOTH', 'LUGGAGE', 'FIRETRUCK', 'SOAP', 'CASTLE', 'WHEAT', 'MOON', 'AERIAL'
  , 'PALM TREE', 'PANIC ATTACK', 'TRACTOR', 'BOTTLE', 'THERMOMETER'
  , 'DINOSAUR', 'RABBIT', 'WORM', 'HOSE', 'SNOOZE', 'BOOK', 'RIVER', 'PANTS'
  , 'SUITCASE', 'HEATWAVE', 'SATELLITE DISH', 'SPATULA', 'COOKIE', 'HIGH JUMP'
  , 'SEESAW', 'FROG', 'LUNCHBOX', 'ECLIPSE', 'ANCHOR', 'BALL', 'GOLD'
  , 'WINDMILL', 'RING', 'THIEF', 'BURGLAR', 'CAVE', 'PENCIL SHARPENER'
  , 'WOLF', 'BEEHIVE', 'LIZARD', 'CORAL', 'POND', 'BAMBOO', 'ROOSTER'
  , 'CHERRY BLOSSOM', 'STRAW', 'JELLY', 'VASE', 'BASKET', 'SHORTS', 'PARROT'
  , 'DOLL', 'FAN', 'ZIPPER', 'GLOVES', 'PEARL', 'SLED', 'LADDER', 'SKIS'
  , 'TUNNEL', 'HAMMER', 'SWING', 'CROWN', 'CHEST', 'COAT', 'BARREL', 'WHEEL'
  , 'BENCH', 'BOOT', 'NEST', 'TURTLE', 'STARFISH', 'GOAT', 'DUST', 'SHIRT'
  , 'PITCHFORK', 'WHEELBARROW', 'SADDLE', 'MOP', 'BUCKET', 'BROOM', 'PUMPKIN'
  , 'DRILL', 'SHELL', 'WELL', 'BELL', 'LOG', 'TORCH', 'LEAF', 'ROCK', 'STICK'
  , 'GRASS', 'FEATHER', 'MATCH', 'BRUSH', 'COMB', 'COIN', 'NOTEBOOK'
  , 'PAPERCLIP', 'SCISSORS', 'PAINT', 'CANVAS', 'STAMP', 'ENVELOPE'
  , 'MAILBOX', 'FLAGPOLE', 'CRANE', 'YACHT', 'FANTESY', 'TAXI', 'AMBULANCE'
  , 'FIRE HYDRANT', 'STREETLIGHT', 'PARKING METER', 'SIGNPOST', 'SIDEWALK'
  , 'CROSSWALK', 'BENCH', 'FOUNTAIN', 'MONUMENT', 'STATUE', 'PLAYGROUND'
  , 'SANDBOX', 'SLIDE', 'CAROUSEL', 'ROLLERCOASTER', 'FERRIS WHEEL'
  , 'TICKET BOOTH', 'POPCORN MACHINE', 'COTTON CANDY', 'HOT AIR BALLOON'
  , 'BLIMP', 'HANG GLIDER', 'JETPACK', 'SPACESUIT', 'METEOR', 'COMET'
  , 'GALAXY', 'NEBULA', 'CONSTELLATION', 'SOLAR PANEL', 'WIND TURBINE'
  , 'DAM', 'FACTORY', 'WAREHOUSE', 'GREENHOUSE', 'BARN', 'SILO', 'WINDMILL'
  , 'WATERMILL', 'LIGHTHOUSE', 'DOCK', 'PIER', 'BUOY', 'ANCHOR', 'HELM'
  , 'MAST', 'SAIL', 'PADDLE', 'PORN', 'LIFEBUOY', 'LIFE JACKET', 'COMPASS'
  , 'TREASURE CHEST', 'MAP', 'SPYGLASS', 'CANNON', 'CANNONBALL', 'FLAG'
  , 'SWORD', 'SHIELD', 'SPEAR', 'BOW', 'ARROW', 'TARGET', 'QUIVER', 'ARMOR'
  , 'HELMET', 'GAUNTLET', 'BOOTS', 'CAPE', 'CLOAK', 'MASK', 'WAND'
  , 'STAFF', 'CRYSTAL BALL', 'POTION', 'CAULDRON', 'SPELLBOOK', 'SCROLL'
  , 'AMULET', 'TALISMAN', 'RING', 'TIARA', 'SCEPTER', 'THRONE', 'GOBLET'
  , 'CHALICE', 'HOURGLASS', 'SUNDIAL', 'METRONOME', 'STOPWATCH', 'CALENDAR'
  , 'ALARM CLOCK', 'PENDULUM', 'COMPASS', 'PRISM', 'KALEIDOSCOPE', 'PERISCOPE'
  , 'MAGNIFYING GLASS', 'BINOCULARS', 'TELESCOPE', 'MICROSCOPE', 'CAMERA'
  , 'PROJECTOR', 'SCREEN', 'MONITOR', 'KEYBOARD', 'MOUSE', 'JOYSTICK'
  , 'HEADPHONES', 'SPEAKER', 'MICROPHONE', 'RADIO', 'ANTENNA'
  , 'WALKIE TALKIE', 'CASSETTE', 'VINYL RECORD', 'PHONOGRAPH', 'JUKEBOX'
  , 'ACCORDION', 'BAGPIPES', 'BANJO', 'FUCK', 'CLARINET', 'CYMBALS'
  , 'DRUM', 'FLUTE', 'HARP', 'LUTE', 'MANDOLIN', 'OBOE', 'ORGAN', 'PIANO'
  , 'RECORDER', 'SAXOPHONE', 'TAMBOURINE', 'TRIANGLE', 'TROMBONE', 'TRUMPET'
  , 'TUBA', 'UKULELE', 'VIOLIN', 'XYlOPHONE' 
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

// ---------- Chess helpers ----------

function newChessRoom(room: Room, prev?: ChessRoom): ChessRoom {
  const ids = room.players.map(p => p.id);
  let whiteId: string | null = ids[0] ?? null;
  let blackId: string | null = ids[1] ?? null;

  // Rematch: swap colors so the other player gets white
  if (prev && prev.whiteId && prev.blackId && ids.includes(prev.whiteId) && ids.includes(prev.blackId)) {
    whiteId = prev.blackId;
    blackId = prev.whiteId;
  }
  return { game: new Chess(), whiteId, blackId, resigned: null };
}

// Make sure every player in the room has a seat (white / black)
function seatChessPlayers(room: Room) {
  const c = room.chess;
  if (!c) return;
  const ids = room.players.map(p => p.id);
  if (c.whiteId && !ids.includes(c.whiteId)) c.whiteId = null;
  if (c.blackId && !ids.includes(c.blackId)) c.blackId = null;
  const free = ids.filter(id => id !== c.whiteId && id !== c.blackId);
  if (!c.whiteId && free.length > 0) c.whiteId = free.shift()!;
  if (!c.blackId && free.length > 0) c.blackId = free.shift()!;
}

// Everything the screens need to draw the board
function buildChessState(room: Room) {
  const c = room.chess!;
  const g = c.game;
  const nameOf = (id: string | null) => room.players.find(p => p.id === id)?.name ?? null;

  const history = g.history({ verbose: true });
  const last = history.length > 0 ? history[history.length - 1] : null;

  const capturedByWhite: string[] = [];
  const capturedByBlack: string[] = [];
  for (const m of history) {
    if (m.captured) {
      if (m.color === 'w') capturedByWhite.push(m.captured);
      else capturedByBlack.push(m.captured);
    }
  }

  let status: 'waiting' | 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resigned' = 'playing';
  let winner: 'w' | 'b' | null = null;
  let reason = '';

  if (c.resigned) {
    status = 'resigned';
    winner = c.resigned === 'w' ? 'b' : 'w';
    reason = `${c.resigned === 'w' ? 'White' : 'Black'} resigned`;
  } else if (g.isCheckmate()) {
    status = 'checkmate';
    winner = g.turn() === 'w' ? 'b' : 'w';
    reason = 'Checkmate';
  } else if (g.isStalemate()) {
    status = 'stalemate';
    reason = 'Stalemate';
  } else if (g.isDraw()) {
    status = 'draw';
    reason = g.isInsufficientMaterial()
      ? 'Not enough pieces to win'
      : g.isThreefoldRepetition()
        ? 'Same position 3 times'
        : '50-move rule';
  } else if (!c.whiteId || !c.blackId) {
    status = 'waiting';
  }

  // Which squares each piece may move to (only for the side whose turn it is)
  const legalMoves: Record<string, { to: string; promotion: boolean; capture: boolean }[]> = {};
  if (status === 'playing') {
    for (const m of g.moves({ verbose: true })) {
      if (!legalMoves[m.from]) legalMoves[m.from] = [];
      if (!legalMoves[m.from].some(x => x.to === m.to)) {
        legalMoves[m.from].push({
          to: m.to,
          promotion: !!m.promotion,
          capture: !!m.captured || m.flags.includes('e')
        });
      }
    }
  }

  return {
    fen: g.fen(),
    turn: g.turn(),
    white: { id: c.whiteId, name: nameOf(c.whiteId) },
    black: { id: c.blackId, name: nameOf(c.blackId) },
    lastMove: last
      ? {
          from: last.from,
          to: last.to,
          san: last.san,
          color: last.color,
          piece: last.piece,
          captured: last.captured ?? null,
          flags: last.flags,
          promotion: last.promotion ?? null
        }
      : null,
    moves: history.map(m => m.san),
    moveCount: history.length,
    inCheck: g.inCheck(),
    status,
    winner,
    reason,
    legalMoves,
    capturedByWhite,
    capturedByBlack
  };
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

    // Chess: start a fresh game when chess is picked, forget it otherwise.
    if (game === 'chess') {
      room.chess = newChessRoom(room);
    } else {
      delete room.chess;
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

  // ---------- Chess ----------

  // Called when the chess screen opens
  socket.on('chess:join', ({ roomCode }) => {
    const code = roomCode?.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return socket.emit('room:error', { message: 'Room not found. Create a new room.' });

    socket.join(code);
    if (!room.chess) room.chess = newChessRoom(room);
    seatChessPlayers(room);
    io.to(code).emit('chess:state', buildChessState(room));
  });

  socket.on('chess:move', ({ roomCode, from, to, promotion }) => {
    const code = roomCode?.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room || !room.chess) return;
    if (typeof from !== 'string' || typeof to !== 'string') return;

    const c = room.chess;
    if (buildChessState(room).status !== 'playing') return;

    // Only the player whose turn it is may move
    const turnId = c.game.turn() === 'w' ? c.whiteId : c.blackId;
    if (socket.id !== turnId) return;

    const attempt: { from: string; to: string; promotion?: string } = { from, to };
    if (typeof promotion === 'string') attempt.promotion = promotion;

    try {
      c.game.move(attempt);
    } catch {
      // Illegal move: ignore it. Sending the real board below fixes the screen.
    }
    io.to(code).emit('chess:state', buildChessState(room));
  });

  socket.on('chess:resign', ({ roomCode }) => {
    const code = roomCode?.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room || !room.chess) return;

    const c = room.chess;
    if (buildChessState(room).status !== 'playing') return;

    if (socket.id === c.whiteId) c.resigned = 'w';
    else if (socket.id === c.blackId) c.resigned = 'b';
    else return;

    io.to(code).emit('chess:state', buildChessState(room));
  });

  socket.on('chess:rematch', ({ roomCode }) => {
    const code = roomCode?.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room || !room.chess) return;

    const status = buildChessState(room).status;
    if (status === 'playing' || status === 'waiting') return; // only after a game ended

    room.chess = newChessRoom(room, room.chess);
    seatChessPlayers(room);
    io.to(code).emit('chess:state', buildChessState(room));
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

      // Tell the chess screen that someone left
      if (room.chess) {
        seatChessPlayers(room);
        io.to(code).emit('chess:state', buildChessState(room));
      }

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
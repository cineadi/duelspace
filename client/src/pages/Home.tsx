import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gamepad2, Users, ArrowRight } from 'lucide-react';
import { socket } from '../services/socket';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your display name first!');
      return;
    }
    socket.emit('room:create', { playerName });
    socket.once('room:created', ({ roomCode }) => {
      navigate(`/room/${roomCode}`, { state: { playerName } });
    });
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your display name first!');
      return;
    }
    if (!joinCode.trim()) {
      setError('Please enter a room code!');
      return;
    }

    socket.emit('room:join', { roomCode: joinCode, playerName });
    socket.once('room:joined', ({ roomCode }) => {
      navigate(`/room/${roomCode}`, { state: { playerName } });
    });
    socket.once('room:error', ({ message }) => {
      setError(message);
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>
      
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center z-10 mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Gamepad2 size={48} className="text-primary" />
          <h1 className="text-5xl font-bold tracking-tight text-white">DuelSpace</h1>
        </div>
        <p className="text-xl text-gray-400">Create a room. Invite your friend. Start playing.</p>
      </motion.div>

      <div className="w-full max-w-md mb-8 z-10">
        <label className="block text-sm font-medium text-gray-300 mb-2">Your Display Name</label>
        <input 
          type="text" 
          placeholder="e.g. Aditya" 
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          className="w-full bg-darker border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary"
        />
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>

      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6 z-10">
        <div className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center">
          <Users size={32} className="text-primary mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Host a Game</h2>
          <p className="text-gray-400 mb-6">Generate a unique code and invite a friend.</p>
          <button 
            onClick={handleCreateRoom}
            className="w-full bg-primary hover:bg-indigo-500 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            Create Room <ArrowRight size={20} />
          </button>
        </div>

        <div className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center">
          <Gamepad2 size={32} className="text-purple-400 mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Join a Game</h2>
          <p className="text-gray-400 mb-6">Have a code from a friend? Enter it below.</p>
          <div className="w-full flex flex-col gap-3">
            <input 
              type="text" 
              placeholder="Room Code (e.g. X7K9P)" 
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={5}
              className="w-full bg-darker border border-gray-700 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-widest uppercase focus:outline-none focus:border-primary"
            />
            <button 
              onClick={handleJoinRoom}
              className="w-full bg-white text-darker font-semibold py-4 rounded-xl transition-all hover:bg-gray-200"
            >
              Join Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
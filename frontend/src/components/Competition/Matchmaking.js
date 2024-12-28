import React, { useState, useEffect } from 'react';
import { useWallet } from '../../context/WalletContext';
import { socket } from '../../services/socket';

const Matchmaking = ({ onMatchFound }) => {
  const { balance, updateBalance } = useWallet();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const ENTRY_FEE = 50; // Fixed entry fee

  useEffect(() => {
    const handleMatchStart = (data) => {
      setSearching(false);
      onMatchFound(data);
    };

    const handleOpponentDisconnected = () => {
      setSearching(false);
      setError('Opponent disconnected. Please try again.');
    };

    socket.on('matchStart', handleMatchStart);
    socket.on('opponentDisconnected', handleOpponentDisconnected);

    return () => {
      socket.off('matchStart', handleMatchStart);
      socket.off('opponentDisconnected', handleOpponentDisconnected);
    };
  }, [onMatchFound]);

  const handleStartSearch = async () => {
    if (balance < ENTRY_FEE) {
      setError('Insufficient balance. You need 50 MC to enter a competition.');
      return;
    }

    try {
      await updateBalance(ENTRY_FEE, 'debit');
      setSearching(true);
      setError(null);
      socket.emit('findMatch', { entryFee: ENTRY_FEE });
    } catch (error) {
      setError(error.message);
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
      <div className="max-w-md w-full p-8 bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
        <h2 className="text-3xl font-bold text-center mb-8 text-neon-blue">
          Finding Opponent
        </h2>

        <div className="text-center mb-6 text-gray-300">
          <p className="mb-2">Entry Fee: 50 MC</p>
          <p>Your Balance: {balance} MC</p>
        </div>

        {error && (
          <div className="mb-6 text-red-500 text-center bg-red-900/30 p-3 rounded-lg border border-red-500/50">
            {error}
          </div>
        )}

        <button
          onClick={handleStartSearch}
          disabled={searching || balance < ENTRY_FEE}
          className={`w-full py-4 rounded-lg text-white font-medium transition-all duration-300 ${
            searching
              ? 'bg-gray-600 cursor-not-allowed'
              : balance < ENTRY_FEE
              ? 'bg-red-600/50 cursor-not-allowed'
              : 'bg-gradient-to-r from-neon-blue to-neon-purple hover:opacity-90 transform hover:scale-[1.02]'
          }`}
        >
          {searching ? (
            <div className="flex items-center justify-center space-x-3">
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
              <span>Finding Opponent...</span>
            </div>
          ) : (
            'Start Competition'
          )}
        </button>

        {searching && (
          <div className="mt-6 text-center text-gray-400">
            <p>Searching for an opponent...</p>
            <p className="text-sm mt-2">This usually takes less than a minute</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Matchmaking; 
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../context/WalletContext';
import { useAuth } from '../../context/AuthContext';

const CompetitionResults = ({ results, competitionData }) => {
  const { balance } = useWallet();
  const { user } = useAuth();
  const navigate = useNavigate();

  const calculateWinner = () => {
    const player = results.find(r => r.isCurrentUser);
    const opponent = results.find(r => !r.isCurrentUser);
    
    if (!player || !opponent) return null;

    // 1. Check proctor violations (tab switches)
    if (player.tabSwitches > opponent.tabSwitches) return opponent.username || 'Opponent';
    if (opponent.tabSwitches > player.tabSwitches) return player.username || 'You';

    // 2. Check hidden test cases
    if (player.hiddenTestsPassed && !opponent.hiddenTestsPassed) return player.username || 'You';
    if (!player.hiddenTestsPassed && opponent.hiddenTestsPassed) return opponent.username || 'Opponent';

    // 3. Check execution time
    if (player.time < opponent.time) return player.username || 'You';
    if (opponent.time < player.time) return opponent.username || 'Opponent';

    return 'Draw';
  };

  // Calculate prize money
  const calculatePrize = () => {
    const winner = calculateWinner();
    const currentPlayer = results.find(r => r.isCurrentUser);
    const totalPool = competitionData.entryFee * 2; // Both players' entry fees
    
    if (winner === 'Draw') {
      return Math.floor(totalPool * 0.5); // Each player gets 50% in case of draw
    }
    
    // Winner gets 90% of the pool, platform keeps 10%
    return winner === currentPlayer.username ? 
      Math.floor(totalPool * 0.9) : 
      0;
  };

  const handleExit = () => {
    navigate('/');
  };

  return (
    <div className="fixed inset-0 bg-[#000000cc] flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-lg max-w-4xl w-full p-6 border border-[#333]">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Match Results</h2>
        
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-white">
            Winner: <span className="text-neon-blue">
              {calculateWinner() === 'You' ? user?.username || 'You' : calculateWinner()}
            </span>
          </h3>
          {calculateWinner() !== 'Draw' && (
            <div className="mt-2">
              <p className="text-green-400 text-xl">
                Prize: {Math.floor(calculatePrize())} MC
              </p>
              <p className="text-sm text-gray-400 mt-1">
                (90% of total pool - {competitionData.entryFee * 2} MC)
              </p>
            </div>
          )}
          {calculateWinner() === 'Draw' && (
            <div className="mt-2">
              <p className="text-blue-400 text-xl">
                Prize: {Math.floor(calculatePrize())} MC each
              </p>
              <p className="text-sm text-gray-400 mt-1">
                (50% of total pool each)
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-8 mb-6">
          {results.map((result, index) => (
            <div 
              key={index}
              className={`bg-[#242424] rounded-lg p-4 border ${
                result.username === calculateWinner() 
                  ? 'border-green-500' 
                  : 'border-[#333]'
              }`}
            >
              <h3 className="text-xl font-bold mb-4">
                <span className="text-white">
                  {result.isCurrentUser ? (user?.username || 'You') : (result.username || 'Opponent')}
                </span>
                {result.isCurrentUser && (
                  <span className="text-sm text-neon-purple ml-2">(You)</span>
                )}
              </h3>
              
              <div className="space-y-3">
                <p className="text-gray-300 font-bold border-b border-[#333] pb-2">
                  Tab Switches: <span className={
                    result.tabSwitches > 0 ? 'text-red-400' : 'text-green-400'
                  }>
                    {result.tabSwitches}
                  </span>
                </p>

                <p className="text-gray-300 font-bold">
                  Hidden Tests: <span className={
                    result.hiddenTestsPassed ? 'text-green-400' : 'text-red-400'
                  }>
                    {result.hiddenTestsPassed ? 'Passed' : 'Failed'}
                  </span>
                </p>

                <p className="text-gray-300">
                  Execution Time: <span className="text-blue-400">{result.time} s</span>
                </p>

                <p className="text-gray-300">
                  Memory Used: <span className="text-blue-400">{result.memory} KB</span>
                </p>

                <p className="text-gray-300">
                  Status: <span className={
                    result.status.id === 3 ? 'text-green-400' : 'text-red-400'
                  }>
                    {result.status.description}
                  </span>
                </p>

                <p className="text-gray-300">
                  Coding Time: <span className="text-blue-400">
                    {Math.round(result.codingTime)}s
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-6">
          <button
            onClick={handleExit}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Exit to Home
          </button>
        </div>

        <p className="text-center text-gray-400 mt-4">
          Current Balance: <span className="text-blue-400 font-bold">{balance} MC</span>
        </p>
      </div>
    </div>
  );
};

export default CompetitionResults;
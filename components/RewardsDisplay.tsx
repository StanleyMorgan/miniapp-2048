import React from 'react';

interface RewardsDisplayProps {
  prize?: number;
  unit?: string;
}

const RewardsDisplay: React.FC<RewardsDisplayProps> = ({ prize, unit }) => {
  return (
    <div className="bg-slate-700 p-3 rounded-lg text-center w-full h-full flex items-center justify-center">
      {prize && unit ? (
        <div className="text-xl font-bold">
            <span className="text-slate-400 uppercase tracking-wider">Total: </span>
            <span className="text-orange-400">{prize}</span>
            <span className="text-white ml-1">{unit}</span>
        </div>
      ) : (
        <div className="text-xl font-bold text-slate-500">-</div>
      )}
    </div>
  );
};

export default RewardsDisplay;
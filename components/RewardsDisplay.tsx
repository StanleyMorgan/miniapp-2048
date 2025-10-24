import React from 'react';

interface RewardsDisplayProps {
  prize?: number;
  unit?: string;
}

const RewardsDisplay: React.FC<RewardsDisplayProps> = ({ prize, unit }) => {
  return (
    <div className="bg-slate-700 p-3 rounded-lg text-center w-full h-full flex flex-col justify-center border-2 border-slate-600">
      <div className="text-xs text-slate-400 uppercase tracking-wider">Rewards</div>
      {prize && unit ? (
        <div className="text-2xl font-bold">
            <span className="text-orange-400">{prize}</span>
            <span className="text-white ml-1">{unit}</span>
        </div>
      ) : (
        <div className="text-2xl font-bold text-slate-500">-</div>
      )}
    </div>
  );
};

export default RewardsDisplay;
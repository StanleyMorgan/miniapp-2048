import React from 'react';

interface RewardsDisplayProps {
  prize?: number;
  unit?: string;
}

const RewardsDisplay: React.FC<RewardsDisplayProps> = ({ prize, unit }) => {
  return (
    <div className="bg-slate-700 py-2 px-3 rounded-lg text-center w-full h-full flex items-center justify-center">
      {prize && unit ? (
        <div className="uppercase font-bold">
            <span className="text-slate-300 uppercase tracking-wider">Total: </span>
            <span className="text-orange-400">{prize}</span>
            <span className="text-white ml-1">{unit}</span>
        </div>
      ) : (
        <div className="uppercase font-bold text-slate-500">-</div>
      )}
    </div>
  );
};

export default RewardsDisplay;
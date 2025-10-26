import React from 'react';

interface RewardsDisplayProps {
  prize?: number;
  unit?: string;
}

const RewardsDisplay: React.FC<RewardsDisplayProps> = ({ prize, unit }) => {
  return (
    <div className="bg-slate-700 py-2 px-3 rounded-lg w-full h-full flex items-center justify-between">
      <span className="uppercase font-bold text-slate-300 tracking-wider">Total: </span>
      {typeof prize === 'number' && typeof unit === 'string' ? (
        <div className="uppercase font-bold">
            <span className="text-orange-400">{prize}</span>
            <span className="text-white ml-1">{unit}</span>
        </div>
      ) : (
        <span className="uppercase font-bold text-white">****</span>
      )}
    </div>
  );
};

export default RewardsDisplay;
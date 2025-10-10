import React from 'react';
import type { TileData } from '../types';

const TILE_COLORS: { [key: number]: string } = {
  2: 'bg-slate-200 text-slate-800',
  4: 'bg-slate-300 text-slate-900',
  8: 'bg-orange-300 text-white',
  16: 'bg-orange-400 text-white',
  32: 'bg-orange-500 text-white',
  64: 'bg-red-500 text-white',
  128: 'bg-yellow-400 text-white font-bold',
  256: 'bg-yellow-500 text-white font-bold',
  512: 'bg-yellow-600 text-white font-bold',
  1024: 'bg-indigo-500 text-white font-extrabold',
  2048: 'bg-indigo-700 text-white font-extrabold',
};

const Tile: React.FC<TileData> = ({ value, row, col, isNew, isMerged }) => {
  const colorClasses = TILE_COLORS[value] || 'bg-black text-white';
  
  let animationClass = '';
  if (isNew) {
    animationClass = 'animate-tile-spawn';
  } else if (isMerged) {
    animationClass = 'animate-tile-merge';
  }

  const textSizeClass = value > 1000 ? 'text-2xl md:text-3xl' : value > 100 ? 'text-3xl md:text-4xl' : 'text-4xl md:text-5xl';
  
  // Base (small screens): tile is 5rem (w-20), gap is 1rem (gap-4). Total step is 6rem.
  // MD screens: tile is 6rem (w-24), gap is 1rem (gap-4). Total step is 7rem.
  // Board has 1rem padding (p-4), which is the initial offset.
  const topPosition = `top-[calc(1rem+${row}*6rem)] md:top-[calc(1rem+${row}*7rem)]`;
  const leftPosition = `left-[calc(1rem+${col}*6rem)] md:left-[calc(1rem+${col}*7rem)]`;
  
  return (
    <div 
      className={`
        w-20 h-20 md:w-24 md:h-24 rounded-md 
        flex items-center justify-center 
        font-bold select-none
        absolute z-10
        transition-all duration-200 ease-in-out
        ${topPosition}
        ${leftPosition}
        ${colorClasses}
        ${animationClass}
      `}
    >
      <div className={`${textSizeClass}`}>{value}</div>
    </div>
  );
};

export default Tile;
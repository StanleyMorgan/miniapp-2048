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
  4096: 'bg-purple-600 text-white font-extrabold',
  8192: 'bg-purple-800 text-white font-extrabold',
  16384: 'bg-teal-500 text-white font-extrabold',
  32768: 'bg-teal-700 text-white font-extrabold',
  65536: 'bg-lime-500 text-white font-extrabold',
  131072: 'bg-gray-900 text-white font-extrabold',
};

const Tile: React.FC<TileData> = ({ value, row, col, isNew, isMerged }) => {
  const colorClasses = TILE_COLORS[value] || 'bg-black text-white';
  
  let animationClass = '';
  if (isNew) {
    animationClass = 'animate-tile-spawn';
  } else if (isMerged) {
    animationClass = 'animate-tile-merge';
  }

  let textSizeClass;
  if (value >= 100000) { // 6+ digits
    textSizeClass = 'text-base sm:text-xl';
  } else if (value >= 10000) { // 5 digits
    textSizeClass = 'text-lg sm:text-2xl';
  } else if (value >= 1000) { // 4 digits
    textSizeClass = 'text-xl sm:text-3xl';
  } else if (value >= 100) { // 3 digits
    textSizeClass = 'text-2xl sm:text-4xl';
  } else { // 1-2 digits
    textSizeClass = 'text-3xl sm:text-5xl';
  }
  
  // Base (small screens): tile is 4rem (w-16), gap is 0.75rem (gap-3). Total step is 4.75rem. Padding is 0.75rem.
  // SM screens: tile is 5rem (w-20), gap is 1rem (gap-4). Total step is 6rem. Padding is 1rem.
  const topPosition = `top-[calc(0.75rem+${row}*4.75rem)] sm:top-[calc(1rem+${row}*6rem)]`;
  const leftPosition = `left-[calc(0.75rem+${col}*4.75rem)] sm:left-[calc(1rem+${col}*6rem)]`;
  
  return (
    <div 
      className={`
        w-16 h-16 sm:w-20 sm:h-20 rounded-md 
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
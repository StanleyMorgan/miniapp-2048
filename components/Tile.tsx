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
    textSizeClass = 'text-lg sm:text-2xl';
  } else if (value >= 10000) { // 5 digits
    textSizeClass = 'text-xl sm:text-3xl';
  } else if (value >= 1000) { // 4 digits
    textSizeClass = 'text-2xl sm:text-4xl';
  } else if (value >= 100) { // 3 digits
    textSizeClass = 'text-3xl sm:text-5xl';
  } else { // 1-2 digits
    textSizeClass = 'text-4xl sm:text-6xl';
  }
  
  // Calculation for responsive positioning and sizing based on the GameBoard's CSS.
  // GameBoard has p-[2%] and gap-[2%].
  // Total width: 100%
  // Padding: 2% on each side (total 4%)
  // Gaps: 3 gaps of 2% each (total 6%)
  // Remaining for cells: 100% - 4% - 6% = 90%
  // Each of 4 cells: 90% / 4 = 22.5%
  const PADDING_PERCENT = 2;
  const GAP_PERCENT = 2;
  const NUM_CELLS = 4;
  const CELL_PERCENT = (100 - (2 * PADDING_PERCENT) - ((NUM_CELLS - 1) * GAP_PERCENT)) / NUM_CELLS;
  
  const style = {
    width: `${CELL_PERCENT}%`,
    height: `${CELL_PERCENT}%`,
    top: `${PADDING_PERCENT + row * (CELL_PERCENT + GAP_PERCENT)}%`,
    left: `${PADDING_PERCENT + col * (CELL_PERCENT + GAP_PERCENT)}%`,
  };
  
  return (
    <div 
      style={style}
      className={`
        rounded-md 
        flex items-center justify-center 
        font-bold select-none
        absolute z-10
        transition-all duration-200 ease-in-out
        ${colorClasses}
        ${animationClass}
      `}
    >
      <div className={`${textSizeClass}`}>{value}</div>
    </div>
  );
};

export default React.memo(Tile);
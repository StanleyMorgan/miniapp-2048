import React from 'react';
import type { TileData } from '../types';
import Tile from './Tile';

interface GameBoardProps {
  tiles: TileData[];
}

const GameBoard: React.FC<GameBoardProps> = ({ tiles }) => {
  const gridCells = Array.from({ length: 16 }).map((_, index) => (
    <div key={index} className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-700 rounded-md"></div>
  ));

  return (
    <div className="bg-slate-600 p-2 sm:p-3 rounded-lg grid grid-cols-4 grid-rows-4 gap-2 sm:gap-3 relative">
      {gridCells}
      {tiles.map(tile => (
        <Tile key={tile.id} {...tile} />
      ))}
    </div>
  );
};

export default GameBoard;
import React from 'react';
import type { TileData } from '../types';
import Tile from './Tile';

interface GameBoardProps {
  tiles: TileData[];
}

const GameBoard: React.FC<GameBoardProps> = ({ tiles }) => {
  const gridCells = Array.from({ length: 16 }).map((_, index) => (
    <div key={index} className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-700 rounded-md"></div>
  ));

  return (
    <div className="bg-slate-600 p-3 sm:p-4 rounded-lg grid grid-cols-4 grid-rows-4 gap-3 sm:gap-4 relative">
      {gridCells}
      {tiles.map(tile => (
        <Tile key={tile.id} {...tile} />
      ))}
    </div>
  );
};

export default GameBoard;
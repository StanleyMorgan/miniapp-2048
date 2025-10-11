import React from 'react';
import type { TileData } from '../types';
import Tile from './Tile';

interface GameBoardProps {
  tiles: TileData[];
}

const GameBoard: React.FC<GameBoardProps> = ({ tiles }) => {
  const gridCells = Array.from({ length: 16 }).map((_, index) => (
    <div key={index} className="bg-slate-700 rounded-md"></div>
  ));

  return (
    <div className="bg-slate-600 p-[2%] rounded-lg grid grid-cols-4 grid-rows-4 gap-[2%] relative w-full aspect-square">
      {gridCells}
      {tiles.map(tile => (
        <Tile key={tile.id} {...tile} />
      ))}
    </div>
  );
};

export default GameBoard;
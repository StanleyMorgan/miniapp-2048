import React from 'react';

export type Season = 'farcaster' | 'base-s0' | 'celo-s0';

interface SeasonSelectorProps {
  activeSeason: Season;
  onSeasonChange: (season: Season) => void;
}

const seasons: { id: Season; name: string }[] = [
  { id: 'farcaster', name: 'FARCASTER' },
  { id: 'base-s0', name: 'BASE S0' },
  { id: 'celo-s0', name: 'CELO S0' },
];

const SeasonSelector: React.FC<SeasonSelectorProps> = ({ activeSeason, onSeasonChange }) => {
  return (
    <div className="w-full mb-4">
      <label htmlFor="season-select" className="sr-only">Select Season</label>
      <select
        id="season-select"
        value={activeSeason}
        onChange={(e) => onSeasonChange(e.target.value as Season)}
        className="w-full bg-slate-700 text-slate-300 p-3 rounded-lg border-2 border-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors appearance-none text-center uppercase font-bold focus:text-white"
        style={{
          background: 'url(\'data:image/svg+xml;charset=UTF-8,%3csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3e%3cpolyline points="6 9 12 15 18 9"%3e%3c/polyline%3e%3c/svg%3e\') no-repeat right 1rem center/1.5em',
          backgroundOrigin: 'content-box',
          backgroundColor: '#334155' // bg-slate-700
        }}
      >
        {seasons.map(season => (
          <option key={season.id} value={season.id} className="bg-slate-700 text-white font-bold">
            {season.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SeasonSelector;
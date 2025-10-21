import React, { useState, useEffect, useRef } from 'react';

export type Season = 'farcaster' | 'base-s0' | 'celo-s0' | 'monad-s0';

interface SeasonSelectorProps {
  activeSeason: Season;
  onSeasonChange: (season: Season) => void;
}

export const seasons: { id: Season; name: string; shareName?: string }[] = [
  { id: 'farcaster', name: 'FARCASTER' },
  { id: 'monad-s0', name: 'MONAD S0', shareName: 'Monad Season 0' },
  { id: 'base-s0', name: 'BASE S0', shareName: 'Base Season 0' },
  { id: 'celo-s0', name: 'CELO S0', shareName: 'Celo Season 0' },
];

const SeasonSelector: React.FC<SeasonSelectorProps> = ({ activeSeason, onSeasonChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const activeSeasonName = seasons.find(s => s.id === activeSeason)?.name || 'Select Season';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOptionClick = (seasonId: Season) => {
    onSeasonChange(seasonId);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full mb-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-700 text-slate-300 p-3 rounded-lg border-2 border-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors uppercase font-bold focus:text-white flex justify-between items-center"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{activeSeasonName}</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-6 w-6 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div 
          className="absolute top-full mt-1 w-full bg-slate-700 border-2 border-slate-600 rounded-lg z-40 overflow-hidden shadow-lg animate-fade-in"
          style={{ animationDuration: '150ms' }}
          role="listbox"
        >
          {seasons.map(season => (
            <button
              key={season.id}
              onClick={() => handleOptionClick(season.id)}
              className={`w-full text-left p-3 uppercase font-bold text-slate-300 hover:bg-slate-600 hover:text-white transition-colors
                ${activeSeason === season.id ? 'bg-orange-500/20 text-orange-400' : ''}`
              }
              role="option"
              aria-selected={activeSeason === season.id}
            >
              {season.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SeasonSelector;
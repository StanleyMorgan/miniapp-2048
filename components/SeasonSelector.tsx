
import React, { useState, useEffect, useRef } from 'react';
import type { SeasonInfo } from '../types';

interface SeasonSelectorProps {
  seasons: SeasonInfo[];
  activeSeasonId: string;
  onSeasonChange: (seasonId: string) => void;
}

const SeasonSelector: React.FC<SeasonSelectorProps> = ({ seasons, activeSeasonId, onSeasonChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const activeSeasonName = seasons.find(s => s.id === activeSeasonId)?.name || 'Select Season';

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

  const handleOptionClick = (seasonId: string) => {
    onSeasonChange(seasonId);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full h-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-full bg-slate-700 text-slate-300 py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors uppercase font-bold focus:text-white flex justify-between items-center"
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
              className={`w-full text-left p-3 uppercase font-bold text-slate-300 hover:bg-slate-600 hover:text-white transition-colors flex justify-between items-center
                ${activeSeasonId === season.id ? 'bg-orange-500/20 text-orange-400' : ''}`
              }
              role="option"
              aria-selected={activeSeasonId === season.id}
            >
              <span>{season.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SeasonSelector;

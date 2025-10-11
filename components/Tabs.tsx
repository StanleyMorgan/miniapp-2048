import React from 'react';

interface TabsProps {
  activeTab: 'game' | 'top';
  onTabChange: (tab: 'game' | 'top') => void;
}

const Tabs: React.FC<TabsProps> = ({ activeTab, onTabChange }) => {
  const getButtonClasses = (tabName: 'game' | 'top') => {
    const baseClasses = 'w-full py-2 px-4 text-center font-bold rounded-md transition-colors duration-200';
    if (activeTab === tabName) {
      return `${baseClasses} bg-orange-500 text-white`;
    }
    return `${baseClasses} bg-slate-700 hover:bg-slate-600 text-slate-300`;
  };

  return (
    <div className="w-full bg-slate-600 p-1 rounded-lg flex justify-center items-center gap-1 mb-4">
      <button
        onClick={() => onTabChange('game')}
        className={getButtonClasses('game')}
        aria-pressed={activeTab === 'game'}
      >
        GAME
      </button>
      <button
        onClick={() => onTabChange('top')}
        className={getButtonClasses('top')}
        aria-pressed={activeTab === 'top'}
      >
        TOP
      </button>
    </div>
  );
};

export default Tabs;

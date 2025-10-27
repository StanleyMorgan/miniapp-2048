import React from 'react';

interface TabsProps {
  activeTab: 'mining' | 'stats';
  onTabChange: (tab: 'mining' | 'stats') => void;
}

const Tabs: React.FC<TabsProps> = ({ activeTab, onTabChange }) => {
  const getButtonClasses = (tabName: 'mining' | 'stats') => {
    const baseClasses = 'w-full py-2 px-4 text-center font-bold rounded-md transition-colors duration-200';
    if (activeTab === tabName) {
      return `${baseClasses} bg-orange-500 text-white`;
    }
    return `${baseClasses} bg-slate-700 hover:bg-slate-600 text-slate-300`;
  };

  return (
    <div className="w-full bg-slate-600 p-1 rounded-lg flex justify-center items-center gap-1 mb-4">
      <button
        onClick={() => onTabChange('mining')}
        className={getButtonClasses('mining')}
        aria-pressed={activeTab === 'mining'}
      >
        MINING
      </button>
      <button
        onClick={() => onTabChange('stats')}
        className={getButtonClasses('stats')}
        aria-pressed={activeTab === 'stats'}
      >
        STATS
      </button>
    </div>
  );
};

export default Tabs;

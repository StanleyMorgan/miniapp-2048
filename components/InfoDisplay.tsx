import React from 'react';

interface InfoDisplayProps {
  title: string;
  value: React.ReactNode;
}

const InfoDisplay: React.FC<InfoDisplayProps> = ({ title, value }) => {
  return (
    <div className="bg-slate-700 py-2 px-3 rounded-lg w-full h-full flex items-center justify-start">
      <div className="uppercase font-bold flex items-center gap-x-2">
        <span className="text-slate-400 uppercase tracking-wider">{title}</span>
        <span className="text-white">{value}</span>
      </div>
    </div>
  );
};

export default InfoDisplay;
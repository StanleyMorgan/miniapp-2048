import React from 'react';

interface InfoDisplayProps {
  title: string;
  value: React.ReactNode;
}

const InfoDisplay: React.FC<InfoDisplayProps> = ({ title, value }) => {
  return (
    <div className="bg-slate-700 py-2 px-3 rounded-lg text-center w-full h-full flex items-center justify-center">
      <div className="uppercase font-bold">
        <span className="text-slate-400 uppercase tracking-wider">{title}: </span>
        <span className="text-white ml-1">{value}</span>
      </div>
    </div>
  );
};

export default InfoDisplay;

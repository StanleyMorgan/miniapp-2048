import React from 'react';

interface InfoDisplayProps {
  title: string;
  value: React.ReactNode;
}

const InfoDisplay: React.FC<InfoDisplayProps> = ({ title, value }) => {
  return (
    <div className="bg-slate-700 py-2 px-3 rounded-lg w-full h-full flex items-center justify-between">
      <span className="uppercase font-bold text-slate-400 tracking-wider">{title}</span>
      <span className="uppercase font-bold text-white">{value}</span>
    </div>
  );
};

export default InfoDisplay;

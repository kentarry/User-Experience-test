import React from 'react';

const Section = ({ title, children }) => (
  <div className="border border-slate-600/50 rounded-lg p-3 bg-slate-800/50">
    <h4 className="text-sm font-bold text-blue-400 mb-3 pb-2 border-b border-slate-600/50 flex items-center justify-between">
      {title}
    </h4>
    {children}
  </div>
);

export default Section;

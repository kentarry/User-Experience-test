import React from 'react';

const InputGroup = ({ label, type = "text", value, onChange }) => (
  <div className="mb-2">
    <label className="text-xs text-slate-400 block mb-1">{label}</label>
    <input
      type={type}
      className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:border-blue-500 outline-none transition-colors"
      value={value}
      onChange={onChange}
    />
  </div>
);

export default InputGroup;

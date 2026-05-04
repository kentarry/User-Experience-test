import React from 'react';
import { AlertTriangle, MessageSquare, X } from 'lucide-react';

const Modal = ({ config, onClose }) => {
  if (!config.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-w-sm w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            {config.isError ? (
              <AlertTriangle className="text-red-400" size={24} />
            ) : (
              <MessageSquare className="text-blue-400" size={24} />
            )}
            <h3 className={`text-lg font-bold ${config.isError ? 'text-red-400' : 'text-blue-400'}`}>
              {config.title}
            </h3>
          </div>
          <p className="text-slate-300 leading-relaxed mb-6 whitespace-pre-wrap">{config.message}</p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors text-sm font-medium"
            >
              確定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;

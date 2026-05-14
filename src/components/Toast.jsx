import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: {
    bg: 'bg-emerald-900/80',
    border: 'border-emerald-500/40',
    icon: 'text-emerald-400',
    bar: 'bg-emerald-400',
  },
  error: {
    bg: 'bg-red-900/80',
    border: 'border-red-500/40',
    icon: 'text-red-400',
    bar: 'bg-red-400',
  },
  info: {
    bg: 'bg-blue-900/80',
    border: 'border-blue-500/40',
    icon: 'text-blue-400',
    bar: 'bg-blue-400',
  },
};

const ToastItem = ({ toast, onRemove }) => {
  const [exiting, setExiting] = useState(false);
  const type = toast.type || 'info';
  const color = COLORS[type] || COLORS.info;
  const Icon = ICONS[type] || ICONS.info;
  const duration = toast.duration || 4000;

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), duration - 400);
    const removeTimer = setTimeout(() => onRemove(toast.id), duration);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.id, duration, onRemove]);

  return (
    <div
      className={`
        relative flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl
        ${color.bg} ${color.border}
        transition-all duration-400 ease-out
        ${exiting ? 'opacity-0 translate-x-8 scale-95' : 'opacity-100 translate-x-0 scale-100'}
        toast-enter
      `}
      style={{ minWidth: 320, maxWidth: 420 }}
    >
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-xl overflow-hidden">
        <div
          className={`h-full ${color.bar} opacity-60`}
          style={{
            animation: `toast-progress ${duration}ms linear forwards`,
          }}
        />
      </div>

      <Icon size={20} className={`${color.icon} mt-0.5 flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-bold text-white mb-0.5">{toast.title}</p>
        )}
        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{toast.message}</p>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-slate-400 hover:text-white transition-colors flex-shrink-0 mt-0.5"
      >
        <X size={14} />
      </button>
    </div>
  );
};

const ToastContainer = ({ toasts, removeToast }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[300] flex flex-col gap-3 pointer-events-auto">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

export default ToastContainer;

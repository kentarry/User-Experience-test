import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info, Sparkles, Users } from 'lucide-react';

const useCountUp = (target, duration = 800) => {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    const start = prevTarget.current;
    const end = target;
    prevTarget.current = target;

    if (start === end) {
      setCount(end);
      return;
    }

    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);

  return count;
};

const StatCard = ({ icon: Icon, label, value, unit, iconColor }) => {
  const displayValue = useCountUp(value);

  return (
    <div className="rounded-xl border border-slate-800 p-5 bg-slate-900">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className={iconColor} />
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold text-white tabular-nums tracking-tight">
          {displayValue}
        </span>
        {unit && <span className="text-sm text-slate-500 font-medium">{unit}</span>}
      </div>
    </div>
  );
};

const DashboardStats = ({ data }) => {
  const critLen = data.criticalIssues?.length || 0;
  const secLen = data.secondaryIssues?.length || 0;
  const aiLen = data.aiAnalysis?.length || 0;
  const testerCount = data.meta?.testerCount || 0;

  return (
    <div className="grid grid-cols-4 gap-4 mb-8">
      <StatCard
        icon={AlertTriangle}
        label="重要問題"
        value={critLen}
        unit="項"
        iconColor="text-rose-500"
      />
      <StatCard
        icon={Info}
        label="次要問題"
        value={secLen}
        unit="項"
        iconColor="text-blue-500"
      />
      <StatCard
        icon={Sparkles}
        label="AI 圖像分析"
        value={aiLen}
        unit="張"
        iconColor="text-amber-500"
      />
      <StatCard
        icon={Users}
        label="測試人數"
        value={testerCount}
        unit="人"
        iconColor="text-violet-500"
      />
    </div>
  );
};

export default DashboardStats;

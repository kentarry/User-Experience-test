import React, { useState } from 'react';
import { Key, FileSpreadsheet, Sparkles, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

const guideSteps = [
  {
    icon: Key,
    title: '步驟 1：輸入 API Key',
    desc: '前往 Google AI Studio 取得免費的 Gemini API Key，貼到右側面板即可啟用 AI 分析。',
  },
  {
    icon: FileSpreadsheet,
    title: '步驟 2：匯入 Excel 資料',
    desc: '上傳使用者體驗 Excel 檔案，AI 將自動清洗、歸納問題、統計頻率並分類重要/次要問題。',
  },
  {
    icon: Sparkles,
    title: '步驟 3：上傳截圖 AI 分析',
    desc: '上傳遊戲截圖，AI 將以 UI/UX 專家角度分析畫面，提供觀察與改善建議。',
  },
];

const OnboardingGuide = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 transition-colors text-left"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <HelpCircle size={14} />
          操作說明
        </span>
        {isOpen ? (
          <ChevronUp size={14} className="text-slate-500" />
        ) : (
          <ChevronDown size={14} className="text-slate-500" />
        )}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2 px-1">
          {guideSteps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={idx} className="rounded-lg border border-slate-700 bg-slate-800 p-3">
                <div className="flex items-start gap-3">
                  <Icon size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-slate-200 mb-0.5">{step.title}</h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OnboardingGuide;

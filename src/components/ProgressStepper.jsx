import React from 'react';
import { Key, FileSpreadsheet, ImageIcon, Download, Check } from 'lucide-react';

const steps = [
  { icon: Key, shortLabel: '金鑰' },
  { icon: FileSpreadsheet, shortLabel: '匯入' },
  { icon: ImageIcon, shortLabel: '分析' },
  { icon: Download, shortLabel: '匯出' },
];

const ProgressStepper = ({ apiKey, hasData, hasAiAnalysis }) => {
  let currentStep = 0;
  if (apiKey) currentStep = 1;
  if (apiKey && hasData) currentStep = 2;
  if (apiKey && hasData && hasAiAnalysis) currentStep = 3;

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-800">
      {steps.map((step, idx) => {
        const StepIcon = step.icon;
        const isCompleted = idx < currentStep;
        const isCurrent = idx === currentStep;

        return (
          <React.Fragment key={idx}>
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isCompleted
                    ? 'bg-slate-700 border border-slate-600'
                    : isCurrent
                    ? 'bg-slate-700 border border-slate-500'
                    : 'bg-slate-800 border border-slate-700'
                }`}
              >
                {isCompleted ? (
                  <Check size={10} className="text-emerald-400" />
                ) : (
                  <StepIcon size={10} className={isCurrent ? 'text-slate-300' : 'text-slate-600'} />
                )}
              </div>
              <span className={`text-[10px] font-medium truncate ${
                isCompleted ? 'text-slate-400' : isCurrent ? 'text-slate-300' : 'text-slate-600'
              }`}>
                {step.shortLabel}
              </span>
            </div>

            {idx < steps.length - 1 && (
              <div className="flex-1 min-w-[12px] max-w-[32px] h-px mx-0.5">
                <div className={`h-full rounded-full ${idx < currentStep ? 'bg-slate-600' : 'bg-slate-800'}`} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default ProgressStepper;

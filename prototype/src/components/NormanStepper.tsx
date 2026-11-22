import React from 'react';
import { ArrowRight, CheckCircle2, Circle, Compass } from 'lucide-react';
import { NORMAN_STAGES } from '../data/courseAssignments';
import { NormanStageNumber, WorkflowMode } from '../types';

interface NormanStepperProps {
  currentStage: NormanStageNumber;
  nextStepInstruction: string;
  workflowMode: WorkflowMode;
  hasRunCode: boolean;
  isVerified: boolean;
  onRunCode: () => void;
  onFocusChat: () => void;
  onOpenReport: () => void;
}

export const NormanStepper: React.FC<NormanStepperProps> = ({
  currentStage,
  nextStepInstruction,
  workflowMode,
  hasRunCode,
  isVerified,
  onRunCode,
  onFocusChat,
  onOpenReport,
}) => {
  const activeMeta = NORMAN_STAGES.find((s) => s.stage === currentStage) ?? NORMAN_STAGES[0];

  const getPrimaryAction = () => {
    if (isVerified) {
      return { label: 'Open Professor Report', onClick: onOpenReport };
    }
    if (workflowMode === 'run_first' && !hasRunCode) {
      return { label: 'Run Code Now', onClick: onRunCode };
    }
    if (currentStage === 4) {
      return { label: 'Run Code Now', onClick: onRunCode };
    }
    return { label: 'Respond to Ustaad', onClick: onFocusChat };
  };

  const primaryAction = getPrimaryAction();

  return (
    <section
      aria-label="Don Norman Seven Stages of Action Guidance"
      className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-sky-800 shrink-0">
            <Compass className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-sky-800">
                Next Step · Stage {activeMeta.stage} of 7 ({activeMeta.phase})
              </span>
              <span aria-hidden="true">·</span>
              <span>{activeMeta.name}</span>
            </div>
            <p className="text-sm font-medium text-slate-900">
              {nextStepInstruction}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={primaryAction.onClick}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-800 hover:bg-sky-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
        >
          <span>{primaryAction.label}</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2 border-t border-slate-100">
        {NORMAN_STAGES.map((stage) => {
          const isCompleted = stage.stage < currentStage || (stage.stage === 7 && isVerified);
          const isCurrent = stage.stage === currentStage && !isVerified;

          return (
            <div
              key={stage.stage}
              className={`rounded-lg px-2.5 py-2 border text-left transition-colors ${
                isCurrent
                  ? 'bg-sky-50 border-sky-300 text-slate-900'
                  : isCompleted
                    ? 'bg-emerald-50/70 border-emerald-200 text-slate-800'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-[11px] font-semibold tabular-nums">
                <span>
                  {stage.stage}. {stage.phase}
                </span>
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-label="Completed" />
                ) : (
                  <Circle
                    className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-sky-700' : 'text-slate-300'}`}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="mt-1 text-xs font-medium truncate" title={stage.name}>
                {stage.name}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

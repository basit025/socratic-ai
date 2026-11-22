import React from 'react';
import { ArrowRight, Eye, PlayCircle } from 'lucide-react';
import { NORMAN_STAGES } from '../data/courseAssignments';

interface NormanModelViewProps {
  onReturnToWorkspace: () => void;
}

export const NormanModelView: React.FC<NormanModelViewProps> = ({ onReturnToWorkspace }) => {
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-semibold text-sky-800">
            Human-Computer Interaction Architecture
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Don Norman’s Seven Stages of Action
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Every interaction in this workspace is structured around Don Norman’s action cycle so students always know what to do next and teachers can trust that students genuinely understand their assignments.
          </p>
        </div>

        <button
          type="button"
          onClick={onReturnToWorkspace}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-800 hover:bg-sky-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>Return to Workspace</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2.5 text-sky-800">
            <PlayCircle className="w-5 h-5" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">
              Minimizing the Gulf of Execution
            </h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            The Gulf of Execution is the gap between what the student wants to do and figuring out how the interface lets them do it.
          </p>
          <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
            <li>A persistent Next Step banner names the exact action required right now.</li>
            <li>No hidden menus or gamified distractions (no XP counters, streaks, or badges).</li>
            <li>Clear segmented controls for Language and Workflow Mode instead of buried settings.</li>
            <li>Course units include starter scaffolds so students understand the assignment scope immediately.</li>
          </ul>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2.5 text-emerald-700">
            <Eye className="w-5 h-5" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">
              Minimizing the Gulf of Evaluation
            </h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            The Gulf of Evaluation is the effort required to interpret what happened after taking an action and compare it against the goal.
          </p>
          <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5">
            <li>Actual program output sits directly beneath the code alongside the Expected Outcome.</li>
            <li>Runtime states use explicit labels and icons (Executed, Error, Pending), never color alone.</li>
            <li>Ustaad connects the observed output directly to targeted Socratic questions.</li>
            <li>The 4-point Comprehension Checklist makes verification progress transparent to both student and professor.</li>
          </ul>
        </section>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">
            Stage-by-Stage Mapping (Learnability &amp; Academic Trust)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4">Phase</th>
                <th className="py-3 px-4">User Question</th>
                <th className="py-3 px-4">How the Interface Helps</th>
                <th className="py-3 px-4">Why Professors Trust It</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {NORMAN_STAGES.map((item) => (
                <tr key={item.stage} className="align-top">
                  <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                    {item.stage}. {item.name}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                    {item.phase}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">
                    {item.studentQuestion}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {item.uiSupport}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {item.professorValue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};

import React from 'react';
import { ArrowRight, CheckCircle2, Scale } from 'lucide-react';

interface RequirementsViewProps {
  onReturnToWorkspace: () => void;
}

export const RequirementsView: React.FC<RequirementsViewProps> = ({ onReturnToWorkspace }) => {
  const functionalReqs = [
    {
      id: 'FR-01',
      title: 'Assignment Goal & Course Context',
      detail: 'Students select a course assignment or enter a custom assignment prompt so both learner and teacher see the exact goal and expected outcome.',
    },
    {
      id: 'FR-02',
      title: 'Dual Workflow Support (Run-First vs Explain-First)',
      detail: 'Supports both "Run Code First, Then Explain Output" and "Explain Logic First, Then Unlock Run" so beginners and advanced courses can choose what fits best.',
    },
    {
      id: 'FR-03',
      title: 'Non-Spoiling Socratic Mentor',
      detail: 'The AI mentor evaluates the student’s code and output without ever writing or completing assignment code for them.',
    },
    {
      id: 'FR-04',
      title: 'Live In-Browser Execution',
      detail: 'Executes Python (Pyodide), JavaScript, and HTML/CSS directly in the workspace and surfaces clear runtime errors.',
    },
    {
      id: 'FR-05',
      title: 'Professor Verification Report',
      detail: 'Produces an objective, copyable verification summary showing code, observed output, comprehension checks, and Q&A evidence.',
    },
  ];

  const nonFunctionalReqs = [
    {
      id: 'NFR-01',
      title: 'High Learnability (Zero-Clutter Interface)',
      detail: 'Removes distracting gamification (XP, streaks, confetti) and keeps next steps visible at all times so new users learn the system in under a minute.',
    },
    {
      id: 'NFR-02',
      title: 'Academic Integrity & Trust',
      detail: 'Verification depends on the student explaining their own code and output in plain words, preventing blind AI copy-pasting.',
    },
    {
      id: 'NFR-03',
      title: 'Accessibility & Legibility',
      detail: 'Maintains WCAG AA contrast, keyboard focus indicators, tabular numerals, and dual-coded states (icons + explicit text labels, never color alone).',
    },
    {
      id: 'NFR-04',
      title: 'Server-Side API Reliability',
      detail: 'All Gemini calls run server-side with structured JSON schemas and exponential backoff retries so transient failures do not lose student work.',
    },
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-2 max-w-2xl">
          <div className="text-xs font-semibold text-sky-800">
            System Specification &amp; Workflow Trade-Offs
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Functional &amp; Non-Functional Requirements
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Focused strictly on what creates real educational value for students and authentic evaluation trust for teachers and professors.
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

      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-sky-800">
          <Scale className="w-5 h-5" aria-hidden="true" />
          <h2 className="text-lg font-bold text-slate-900">
            What Matters More: Run Output First vs. Explain Logic First?
          </h2>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          From an HCI and professor-trust perspective, <strong>verifying authentic comprehension matters more than the exact order</strong>—however, each workflow serves a distinct learning need:
        </p>

        <div className="grid md:grid-cols-2 gap-4 pt-2">
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-2">
            <div className="text-sm font-bold text-slate-900">
              1. Run Output First, Then Explain (Recommended Default)
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Students write code, immediately observe real output or errors (minimizing the <strong>Gulf of Evaluation</strong>), and then Ustaad quizzes them on <em>why</em> that specific code produced that output. Even if a student tried pasting code, they cannot pass verification unless they explain it accurately.
            </p>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-2">
            <div className="text-sm font-bold text-slate-900">
              2. Explain Logic First, Then Run (Strict Mode)
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Students must state their assignment goal and algorithm in plain language before execution unlocks. Best for exam prep or introductory labs where professors want to discourage trial-and-error guessing.
            </p>
          </div>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Functional Requirements</h2>
          <div className="divide-y divide-slate-200">
            {functionalReqs.map((req) => (
              <div key={req.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <CheckCircle2 className="w-4 h-4 text-sky-800 shrink-0" aria-hidden="true" />
                  <span className="font-mono text-xs text-slate-500 tabular-nums">{req.id}</span>
                  <span>{req.title}</span>
                </div>
                <p className="text-sm text-slate-600 pl-6">{req.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Non-Functional Requirements</h2>
          <div className="divide-y divide-slate-200">
            {nonFunctionalReqs.map((req) => (
              <div key={req.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                  <span className="font-mono text-xs text-slate-500 tabular-nums">{req.id}</span>
                  <span>{req.title}</span>
                </div>
                <p className="text-sm text-slate-600 pl-6">{req.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};

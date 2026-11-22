import React, { useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Clock, Copy } from 'lucide-react';
import { ChatMessage, ComprehensionChecks, CourseAssignment, Language, WorkflowMode } from '../types';

interface ProfessorReportViewProps {
  studentName: string;
  assignment: CourseAssignment;
  customGoal: string;
  language: Language;
  workflowMode: WorkflowMode;
  code: string;
  lastOutput: string;
  hasRunCode: boolean;
  checks: ComprehensionChecks;
  messages: ChatMessage[];
  onReturnToWorkspace: () => void;
}

export const ProfessorReportView: React.FC<ProfessorReportViewProps> = ({
  studentName,
  assignment,
  customGoal,
  language,
  workflowMode,
  code,
  lastOutput,
  hasRunCode,
  checks,
  messages,
  onReturnToWorkspace,
}) => {
  const [copied, setCopied] = useState(false);

  const effectiveGoal = assignment.id === 'custom' && customGoal.trim()
    ? customGoal.trim()
    : assignment.goalDescription;

  const studentTurns = messages.filter((m) => m.role === 'user');

  const checklistItems = [
    { label: 'Assignment goal clearly understood', passed: checks.goalClear },
    { label: 'Algorithm / code logic explained in own words', passed: checks.logicExplained },
    { label: 'Program execution run and output observed', passed: hasRunCode },
    { label: 'Output behavior accurately interpreted', passed: checks.outputInterpreted },
    { label: 'Authentic understanding verified for grading', passed: checks.understandingVerified },
  ];

  const handleCopyReport = async () => {
    const reportText = [
      'SOCRATIC AI — PROFESSOR VERIFICATION REPORT',
      `Student: ${studentName || 'Unnamed Student'}`,
      `Course / Assignment: ${assignment.courseUnit} — ${assignment.title}`,
      `Language: ${language.toUpperCase()}`,
      `Workflow Mode: ${workflowMode === 'run_first' ? 'Run Output First, Then Explain' : 'Explain Logic First, Then Run'}`,
      `Verification Status: ${checks.understandingVerified ? 'VERIFIED AUTHENTIC UNDERSTANDING' : 'IN PROGRESS — NEEDS FURTHER EXPLANATION'}`,
      '',
      `Assignment Goal: ${effectiveGoal}`,
      '',
      'Comprehension Checks:',
      ...checklistItems.map((c) => `- [${c.passed ? 'x' : ' '}] ${c.label}`),
      '',
      `Ustaad Evaluation Summary: ${checks.professorSummary}`,
      '',
      'Submitted Code:',
      code,
      '',
      'Observed Output:',
      lastOutput || '(Not executed yet)',
      '',
      `Student Explanation Turns (${studentTurns.length}):`,
      ...studentTurns.map((t, i) => `${i + 1}. ${t.text}`),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{assignment.courseUnit}</span>
            <span aria-hidden="true">·</span>
            <span className="uppercase">{language}</span>
            <span aria-hidden="true">·</span>
            <span>{workflowMode === 'run_first' ? 'Run Then Explain' : 'Explain Then Run'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Professor Verification Report
          </h1>
          <p className="text-sm text-slate-600">
            Evidence of authentic student reasoning and output interpretation for grading trust.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleCopyReport}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
            <span>{copied ? 'Copied Summary' : 'Copy Report'}</span>
          </button>

          <button
            type="button"
            onClick={onReturnToWorkspace}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-800 hover:bg-sky-900 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>Return to Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="text-xs font-medium text-slate-500">Student</div>
            <div className="text-base font-bold text-slate-900">
              {studentName.trim() || 'Student Name Not Entered'}
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
              checks.understandingVerified
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            {checks.understandingVerified ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
            ) : (
              <Clock className="w-4 h-4 text-amber-700" aria-hidden="true" />
            )}
            <span>
              {checks.understandingVerified
                ? 'Verified Authentic Understanding'
                : 'In Progress — Complete Socratic Check'}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500">Assignment Goal</div>
          <p className="text-sm text-slate-800">{effectiveGoal}</p>
        </div>

        <div className="space-y-2 pt-2">
          <div className="text-xs font-semibold text-slate-500">Ustaad Evaluation Summary</div>
          <p className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            {checks.professorSummary}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {checklistItems.map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/70 text-xs"
            >
              {item.passed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <span className={item.passed ? 'text-slate-900 font-medium' : 'text-slate-500'}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Submitted Code &amp; Observed Output</h2>
          <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs font-mono overflow-x-auto leading-relaxed">
            {code || '(No code written yet)'}
          </pre>
          <div className="pt-2">
            <div className="text-xs font-semibold text-slate-500 mb-1.5">Observed Execution Output</div>
            <pre className="bg-slate-50 border border-slate-200 text-slate-800 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
              {lastOutput || '(Code has not been executed yet)'}
            </pre>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">
            Student Reasoning Transcript ({messages.length} messages)
          </h2>
          {messages.length === 0 ? (
            <p className="text-sm text-slate-500">
              No Socratic discussion recorded yet. Ask Ustaad in the Workspace to verify your assignment logic.
            </p>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg border text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-sky-50 border-sky-200 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
                    <span>{msg.role === 'user' ? studentName || 'Student' : 'Ustaad Mentor'}</span>
                    <span className="tabular-nums">{msg.timestamp}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

import React, { useEffect, useMemo, useRef } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  Play,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react';
import { COURSE_ASSIGNMENTS } from '../data/courseAssignments';
import {
  ChatMessage,
  ComprehensionChecks,
  CourseAssignment,
  Language,
  NormanStageNumber,
  WorkflowMode,
} from '../types';
import { NormanStepper } from './NormanStepper';

interface WorkspaceViewProps {
  studentName: string;
  onStudentNameChange: (name: string) => void;
  selectedAssignment: CourseAssignment;
  onSelectAssignment: (assignmentId: string) => void;
  customGoal: string;
  onCustomGoalChange: (goal: string) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  workflowMode: WorkflowMode;
  onWorkflowModeChange: (mode: WorkflowMode) => void;
  code: string;
  onCodeChange: (code: string) => void;
  currentStage: NormanStageNumber;
  nextStepInstruction: string;
  allowExecution: boolean;
  hasRunCode: boolean;
  executionStatus: 'idle' | 'success' | 'error';
  lastOutput: string;
  pyodideReady: boolean;
  isExecuting: boolean;
  onRunCode: () => void;
  messages: ChatMessage[];
  chatInput: string;
  onChatInputChange: (val: string) => void;
  isSending: boolean;
  onSendMessage: (overrideText?: string) => void;
  onResetSession: () => void;
  checks: ComprehensionChecks;
  onOpenReport: () => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  studentName,
  onStudentNameChange,
  selectedAssignment,
  onSelectAssignment,
  customGoal,
  onCustomGoalChange,
  language,
  onLanguageChange,
  workflowMode,
  onWorkflowModeChange,
  code,
  onCodeChange,
  currentStage,
  nextStepInstruction,
  allowExecution,
  hasRunCode,
  executionStatus,
  lastOutput,
  pyodideReady,
  isExecuting,
  onRunCode,
  messages,
  chatInput,
  onChatInputChange,
  isSending,
  onSendMessage,
  onResetSession,
  checks,
  onOpenReport,
}) => {
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const lineCount = useMemo(() => Math.max(1, code.split('\n').length), [code]);
  const isRunEnabled = workflowMode === 'run_first' || allowExecution;

  const fileName =
    language === 'python'
      ? 'assignment.py'
      : language === 'javascript'
        ? 'assignment.js'
        : 'assignment.html';

  const effectiveGoal =
    selectedAssignment.id === 'custom'
      ? customGoal
      : selectedAssignment.goalDescription;

  const focusChatInput = () => {
    chatInputRef.current?.focus();
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const next = code.substring(0, start) + '  ' + code.substring(end);
      onCodeChange(next);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSending && chatInput.trim()) {
        onSendMessage();
      }
    }
  };

  const starterPrompts =
    workflowMode === 'run_first'
      ? [
          'I wrote my code and ran it — ask me questions to verify I understand it.',
          'Here is my assignment goal and what I expect my code to do.',
          'My code gave an error — help me think through why.',
        ]
      : [
          'Let me explain the goal and steps of my assignment first.',
          'Here is my plain-language plan before I run the code.',
          'Ask me a question to test if my logic is ready to run.',
        ];

  const comprehensionItems = [
    { label: 'Goal Clear', done: checks.goalClear },
    { label: 'Logic Explained', done: checks.logicExplained },
    { label: 'Output Observed', done: hasRunCode },
    { label: 'Verified for Professor', done: checks.understandingVerified },
  ];

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 space-y-4">
      {/* Workspace Toolbar: Student, Course Assignment, Language, Workflow Mode */}
      <section
        aria-label="Assignment and workflow configuration"
        className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 items-end"
      >
        <div className="xl:col-span-2 space-y-1">
          <label htmlFor="student-name-input" className="block text-xs font-semibold text-slate-600">
            Student Name
          </label>
          <input
            id="student-name-input"
            type="text"
            value={studentName}
            onChange={(e) => onStudentNameChange(e.target.value)}
            placeholder="Enter your name"
            className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-700"
          />
        </div>

        <div className="xl:col-span-4 space-y-1">
          <label htmlFor="assignment-select" className="block text-xs font-semibold text-slate-600">
            Course &amp; Assignment
          </label>
          <select
            id="assignment-select"
            value={selectedAssignment.id}
            onChange={(e) => onSelectAssignment(e.target.value)}
            className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-sky-700"
          >
            {COURSE_ASSIGNMENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.courseUnit} — {a.title}
              </option>
            ))}
          </select>
        </div>

        <div className="xl:col-span-3 space-y-1">
          <span className="block text-xs font-semibold text-slate-600">Language</span>
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg h-9">
            {(['python', 'javascript', 'html'] as Language[]).map((lang) => {
              const active = language === lang;
              const label = lang === 'python' ? 'Python' : lang === 'javascript' ? 'JavaScript' : 'HTML/CSS';
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onLanguageChange(lang)}
                  className={`text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="xl:col-span-3 space-y-1">
          <span className="block text-xs font-semibold text-slate-600">Workflow Order</span>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg h-9">
            <button
              type="button"
              onClick={() => onWorkflowModeChange('run_first')}
              className={`text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                workflowMode === 'run_first'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Run Then Explain
            </button>
            <button
              type="button"
              onClick={() => onWorkflowModeChange('explain_first')}
              className={`text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                workflowMode === 'explain_first'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Explain Then Run
            </button>
          </div>
        </div>
      </section>

      {/* Norman 7-Stage Stepper & Next Step Guidance */}
      <NormanStepper
        currentStage={currentStage}
        nextStepInstruction={nextStepInstruction}
        workflowMode={workflowMode}
        hasRunCode={hasRunCode}
        isVerified={checks.understandingVerified}
        onRunCode={onRunCode}
        onFocusChat={focusChatInput}
        onOpenReport={onOpenReport}
      />

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Zone: Code Execution & State Perception */}
        <section
          aria-label="Assignment code editor and program output"
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden"
        >
          {/* Stage 1: Assignment Goal */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-600">
                Stage 1 · Assignment Goal ({selectedAssignment.courseUnit})
              </div>
              <div className="text-xs text-slate-500">
                Expected: {selectedAssignment.expectedOutcome}
              </div>
            </div>

            {selectedAssignment.id === 'custom' ? (
              <input
                type="text"
                value={customGoal}
                onChange={(e) => onCustomGoalChange(e.target.value)}
                placeholder="Describe your assignment goal (e.g. Write a Python loop to sum even numbers from 1 to 20)"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-sky-700"
              />
            ) : (
              <p className="text-sm text-slate-800 leading-relaxed">{effectiveGoal}</p>
            )}
          </div>

          {/* Code Editor Header */}
          <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-3 text-xs font-mono text-slate-700">
              <span className="font-semibold text-slate-900">{fileName}</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="tabular-nums text-slate-500">{lineCount} lines</span>
              {language === 'python' && !pyodideReady && (
                <>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="text-amber-700">Loading Python runtime...</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {hasRunCode && (
                <button
                  type="button"
                  onClick={() =>
                    onSendMessage(
                      `I ran my code and got this output:\n${lastOutput.slice(0, 200)}\nPlease test my understanding of how my code produced this.`
                    )
                  }
                  disabled={isSending}
                  className="px-3 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  Verify Output with Ustaad
                </button>
              )}

              <button
                type="button"
                onClick={isRunEnabled ? onRunCode : focusChatInput}
                disabled={isExecuting}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  isRunEnabled
                    ? 'bg-sky-800 hover:bg-sky-900 text-white'
                    : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {isRunEnabled ? (
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>
                  {isExecuting
                    ? 'Running...'
                    : isRunEnabled
                      ? 'Run Code'
                      : 'Explain Logic to Unlock'}
                </span>
              </button>
            </div>
          </div>

          {/* Code Editor */}
          <div className="flex bg-slate-950 text-slate-100 min-h-[260px] flex-1">
            <div
              aria-hidden="true"
              className="w-11 py-3 pr-3 text-right font-mono text-xs leading-6 text-slate-500 select-none border-r border-slate-800 tabular-nums"
            >
              {Array.from({ length: lineCount }, (_, idx) => (
                <div key={idx + 1}>{idx + 1}</div>
              ))}
            </div>
            <textarea
              aria-label="Assignment code editor"
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              onKeyDown={handleEditorKeyDown}
              spellCheck={false}
              className="flex-1 bg-transparent p-3 font-mono text-[13px] leading-6 text-slate-100 resize-none focus:outline-none"
              placeholder="Write your assignment code here..."
            />
          </div>

          {/* Stage 5: Perceiving the Output State */}
          <div className="border-t border-slate-200 bg-slate-50">
            <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">
                Stage 5 · Observed Output (Gulf of Evaluation)
              </span>
              <span
                className={`inline-flex items-center gap-1.5 font-semibold ${
                  executionStatus === 'success'
                    ? 'text-emerald-700'
                    : executionStatus === 'error'
                      ? 'text-red-700'
                      : 'text-slate-500'
                }`}
              >
                {executionStatus === 'success' && (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Executed</span>
                  </>
                )}
                {executionStatus === 'error' && (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Runtime Error</span>
                  </>
                )}
                {executionStatus === 'idle' && (
                  <>
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Not Run Yet</span>
                  </>
                )}
              </span>
            </div>

            {language === 'html' && hasRunCode && executionStatus !== 'error' ? (
              <iframe
                title="HTML and CSS Output Preview"
                sandbox="allow-scripts"
                srcDoc={code}
                className="w-full h-44 bg-white border-0"
              />
            ) : (
              <pre
                className={`p-4 font-mono text-xs min-h-[112px] max-h-48 overflow-y-auto whitespace-pre-wrap ${
                  executionStatus === 'error' ? 'text-red-700 bg-red-50/40' : 'text-slate-800'
                }`}
              >
                {lastOutput || 'Click "Run Code" above to inspect your program output.'}
              </pre>
            )}
          </div>
        </section>

        {/* Right Zone: Ustaad Socratic Verification & Comprehension Checklist */}
        <section
          aria-label="Ustaad Socratic explanation and comprehension verification"
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden min-h-[540px] max-h-[760px]"
        >
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50/70">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Ustaad Understanding Check</h2>
              <p className="text-xs text-slate-500">
                Explain your logic in plain words to verify authentic work.
              </p>
            </div>
            <button
              type="button"
              onClick={onResetSession}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 bg-white rounded-lg cursor-pointer"
              title="Reset conversation"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>

          {/* Real Comprehension Checklist (replaces XP/Streak fluff) */}
          <div className="px-4 py-2.5 border-b border-slate-200 grid grid-cols-2 gap-2 bg-white">
            {comprehensionItems.map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-2 text-xs ${
                  item.done ? 'text-emerald-800 font-semibold' : 'text-slate-500'
                }`}
              >
                {item.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 leading-relaxed">
                  Assalamu Alaikum{studentName ? ` ${studentName}` : ''}! I am Ustaad. I will never write your assignment code for you—instead, I help you explain and verify your own work so your professor can trust it. Choose a prompt below or type your explanation.
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-500">Quick Starters</div>
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => onSendMessage(prompt)}
                      className="w-full text-left px-3.5 py-2.5 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:border-sky-400 hover:bg-sky-50/40 rounded-lg transition-colors cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="space-y-1.5">
                  <div
                    className={`rounded-xl p-3.5 text-sm leading-relaxed border ${
                      msg.role === 'user'
                        ? 'bg-sky-50 border-sky-200 text-slate-900 ml-6'
                        : 'bg-white border-slate-200 text-slate-800 mr-4'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 mb-1">
                      <span>
                        {msg.role === 'user'
                          ? studentName || 'Student'
                          : `Ustaad${msg.stageLabel ? ` · ${msg.stageLabel}` : ''}`}
                      </span>
                      <span className="tabular-nums">{msg.timestamp}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  {msg.hint && (
                    <div className="mr-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        <strong>Hint:</strong> {msg.hint}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}

            {isSending && (
              <div className="mr-4 p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-600">
                Ustaad is evaluating your explanation...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Verified Banner inside chat when ready */}
          {checks.understandingVerified && (
            <div className="px-4 py-2.5 bg-emerald-50 border-t border-emerald-200 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-emerald-900">
                Understanding verified for professor review.
              </span>
              <button
                type="button"
                onClick={onOpenReport}
                className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-950 cursor-pointer whitespace-nowrap"
              >
                Open Report
              </button>
            </div>
          )}

          {/* Chat Input */}
          <div className="p-3 border-t border-slate-200 bg-white">
            <div className="flex items-end gap-2">
              <textarea
                ref={chatInputRef}
                aria-label="Explain your logic or output to Ustaad"
                value={chatInput}
                onChange={(e) => onChatInputChange(e.target.value)}
                onKeyDown={handleChatKeyDown}
                rows={2}
                placeholder="Explain what your code does or why it gave that output..."
                className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:border-sky-700"
              />
              <button
                type="button"
                onClick={() => onSendMessage()}
                disabled={isSending || !chatInput.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-sky-800 hover:bg-sky-900 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Send</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

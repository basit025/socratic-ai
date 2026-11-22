import { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { NormanModelView } from './components/NormanModelView';
import { ProfessorReportView } from './components/ProfessorReportView';
import { RequirementsView } from './components/RequirementsView';
import { WorkspaceView } from './components/WorkspaceView';
import { COURSE_ASSIGNMENTS } from './data/courseAssignments';
import {
  ApiChatResponse,
  AppView,
  ChatMessage,
  ComprehensionChecks,
  HistoryEntry,
  Language,
  NormanStageNumber,
  WorkflowMode,
} from './types';

declare global {
  interface Window {
    loadPyodide?: () => Promise<{
      globals: { set: (name: string, fn: (...args: unknown[]) => void) => void };
      runPythonAsync: (code: string) => Promise<unknown>;
    }>;
  }
}

const DEFAULT_CHECKS: ComprehensionChecks = {
  goalClear: false,
  logicExplained: false,
  outputInterpreted: false,
  understandingVerified: false,
  professorSummary:
    'Session started. Student has not yet completed Socratic explanation and output verification.',
};

function getInitialInstruction(mode: WorkflowMode, hasRun: boolean): string {
  if (mode === 'run_first') {
    return hasRun
      ? 'Review your Observed Output below, then explain in chat why your code produced it.'
      : 'Write or inspect your assignment code on the left, then click "Run Code" to observe the output.';
  }
  return 'Explain your assignment goal and logic in plain words to Ustaad to unlock "Run Code".';
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('workspace');
  const [studentName, setStudentName] = useState<string>(
    () => localStorage.getItem('socratic_student_name') || ''
  );
  const [assignmentId, setAssignmentId] = useState<string>(COURSE_ASSIGNMENTS[0].id);
  const [customGoal, setCustomGoal] = useState<string>('');
  const [language, setLanguage] = useState<Language>(COURSE_ASSIGNMENTS[0].language);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('run_first');
  const [code, setCode] = useState<string>(COURSE_ASSIGNMENTS[0].starterCode);

  const [currentStage, setCurrentStage] = useState<NormanStageNumber>(3);
  const [nextStepInstruction, setNextStepInstruction] = useState<string>(() =>
    getInitialInstruction('run_first', false)
  );
  const [allowExecution, setAllowExecution] = useState<boolean>(false);
  const [hasRunCode, setHasRunCode] = useState<boolean>(false);
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastOutput, setLastOutput] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [checks, setChecks] = useState<ComprehensionChecks>(DEFAULT_CHECKS);

  const pyodideRef = useRef<{
    globals: { set: (name: string, fn: (...args: unknown[]) => void) => void };
    runPythonAsync: (code: string) => Promise<unknown>;
  } | null>(null);
  const [pyodideReady, setPyodideReady] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const init = async () => {
      if (typeof window.loadPyodide === 'function') {
        try {
          const instance = await window.loadPyodide();
          if (active) {
            pyodideRef.current = instance;
            setPyodideReady(true);
          }
        } catch (err) {
          console.error('Pyodide failed to load:', err);
        }
      }
    };
    init();
    return () => {
      active = false;
    };
  }, []);

  const selectedAssignment =
    COURSE_ASSIGNMENTS.find((a) => a.id === assignmentId) ?? COURSE_ASSIGNMENTS[0];

  const handleStudentNameChange = (name: string) => {
    setStudentName(name);
    localStorage.setItem('socratic_student_name', name);
  };

  const resetProgressForNewTask = (mode: WorkflowMode) => {
    setCurrentStage(mode === 'run_first' ? 3 : 1);
    setNextStepInstruction(getInitialInstruction(mode, false));
    setAllowExecution(false);
    setHasRunCode(false);
    setExecutionStatus('idle');
    setLastOutput('');
    setMessages([]);
    setHistory([]);
    setChecks(DEFAULT_CHECKS);
  };

  const handleSelectAssignment = (id: string) => {
    const next = COURSE_ASSIGNMENTS.find((a) => a.id === id) ?? COURSE_ASSIGNMENTS[0];
    setAssignmentId(next.id);
    setLanguage(next.language);
    setCode(next.starterCode);
    resetProgressForNewTask(workflowMode);
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    const matching = COURSE_ASSIGNMENTS.find((a) => a.language === lang);
    if (matching && selectedAssignment.id !== 'custom') {
      setAssignmentId(matching.id);
      setCode(matching.starterCode);
      resetProgressForNewTask(workflowMode);
    }
  };

  const handleWorkflowModeChange = (mode: WorkflowMode) => {
    setWorkflowMode(mode);
    setCurrentStage(mode === 'run_first' ? (hasRunCode ? 6 : 3) : allowExecution ? 4 : 2);
    setNextStepInstruction(getInitialInstruction(mode, hasRunCode));
  };

  const handleRunCode = async () => {
    if (workflowMode === 'explain_first' && !allowExecution) return;

    setIsExecuting(true);
    let output = '';
    let status: 'success' | 'error' = 'success';

    try {
      if (language === 'python') {
        if (!pyodideRef.current) {
          output = 'Python runtime is still loading. Please wait a few seconds and click Run Code again.';
          status = 'error';
        } else {
          const logs: string[] = [];
          pyodideRef.current.globals.set('print', (...args: unknown[]) => {
            logs.push(args.map((a) => String(a)).join(' '));
          });
          await pyodideRef.current.runPythonAsync(code);
          output = logs.join('\n') || '(Program finished with no printed output)';
        }
      } else if (language === 'javascript') {
        const originalLog = console.log;
        const logs: string[] = [];
        console.log = (...args: unknown[]) => {
          logs.push(args.map((a) => String(a)).join(' '));
        };
        try {
          // eslint-disable-next-line no-eval
          eval(code);
        } finally {
          console.log = originalLog;
        }
        output = logs.join('\n') || '(Program finished with no console output)';
      } else {
        output = 'HTML/CSS rendered in the preview panel.';
      }
    } catch (err: unknown) {
      status = 'error';
      const msg = err instanceof Error ? err.message : String(err);
      output = `Error: ${msg}`;
    } finally {
      setIsExecuting(false);
    }

    setLastOutput(output);
    setExecutionStatus(status);
    setHasRunCode(true);
    setCurrentStage(5);
    setNextStepInstruction(
      status === 'error'
        ? 'Read the error message below, then ask Ustaad or explain what you think caused it.'
        : 'Inspect the Observed Output below, then explain in chat why your code produced this result.'
    );
  };

  const handleSendMessage = async (overrideText?: string) => {
    const textToSend = (overrideText ?? chatInput).trim();
    if (!textToSend || isSending) return;

    if (!overrideText) {
      setChatInput('');
    }

    const nowLabel = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: nowLabel,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    const effectiveGoal =
      selectedAssignment.id === 'custom' && customGoal.trim()
        ? customGoal.trim()
        : selectedAssignment.goalDescription;

    const contextPrompt = [
      `Student Name: ${studentName.trim() || 'Student'}`,
      `Course Assignment: ${selectedAssignment.courseUnit} — ${selectedAssignment.title}`,
      `Assignment Goal: ${effectiveGoal}`,
      `Language: ${language}`,
      `Workflow Mode: ${workflowMode}`,
      `Current Norman Stage: ${currentStage}`,
      `Code Executed Yet: ${hasRunCode ? 'Yes' : 'No'}`,
      hasRunCode ? `Observed Output:\n${lastOutput}` : '',
      `Student Code:\n\`\`\`${language}\n${code}\n\`\`\``,
      `Student Message: ${textToSend}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: history.slice(-8),
          userPrompt: contextPrompt,
        }),
      });

      const rawBody = await response.text();
      let data: (ApiChatResponse & { error?: string }) | null = null;
      try {
        data = JSON.parse(rawBody) as ApiChatResponse & { error?: string };
      } catch {
        const isHtml = rawBody.trim().toLowerCase().startsWith('<!doctype') || rawBody.trim().toLowerCase().startsWith('<html');
        throw new Error(
          isHtml
            ? `Server returned an HTML page instead of JSON (HTTP ${response.status}). Please refresh the page or check that the backend server is running.`
            : `Unexpected server response (HTTP ${response.status}).`
        );
      }

      if (!response.ok || !data?.reply) {
        throw new Error(data?.error || `Request failed (${response.status})`);
      }

      const { reply } = data;
      const clampedStage = Math.min(7, Math.max(1, Number(reply.normanStage) || 2)) as NormanStageNumber;

      setCurrentStage(clampedStage);
      setNextStepInstruction(reply.nextStepInstruction);
      setAllowExecution(Boolean(reply.allowExecution));
      setChecks(reply.comprehensionChecks);

      setHistory((prev) => [
        ...prev,
        { role: 'user', content: textToSend },
        { role: 'model', content: reply.message },
      ]);

      const aiMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: 'model',
        text: reply.message,
        hint: reply.hint,
        stageLabel: reply.stageLabel,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unable to reach Ustaad right now.';
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'model',
          text: `Could not complete the check: ${errMsg}`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Header
        activeView={activeView}
        onNavigate={setActiveView}
        isVerified={checks.understandingVerified}
      />

      {activeView === 'workspace' && (
        <WorkspaceView
          studentName={studentName}
          onStudentNameChange={handleStudentNameChange}
          selectedAssignment={selectedAssignment}
          onSelectAssignment={handleSelectAssignment}
          customGoal={customGoal}
          onCustomGoalChange={setCustomGoal}
          language={language}
          onLanguageChange={handleLanguageChange}
          workflowMode={workflowMode}
          onWorkflowModeChange={handleWorkflowModeChange}
          code={code}
          onCodeChange={setCode}
          currentStage={currentStage}
          nextStepInstruction={nextStepInstruction}
          allowExecution={allowExecution}
          hasRunCode={hasRunCode}
          executionStatus={executionStatus}
          lastOutput={lastOutput}
          pyodideReady={pyodideReady}
          isExecuting={isExecuting}
          onRunCode={handleRunCode}
          messages={messages}
          chatInput={chatInput}
          onChatInputChange={setChatInput}
          isSending={isSending}
          onSendMessage={handleSendMessage}
          onResetSession={() => resetProgressForNewTask(workflowMode)}
          checks={checks}
          onOpenReport={() => setActiveView('report')}
        />
      )}

      {activeView === 'norman' && (
        <NormanModelView onReturnToWorkspace={() => setActiveView('workspace')} />
      )}

      {activeView === 'requirements' && (
        <RequirementsView onReturnToWorkspace={() => setActiveView('workspace')} />
      )}

      {activeView === 'report' && (
        <ProfessorReportView
          studentName={studentName}
          assignment={selectedAssignment}
          customGoal={customGoal}
          language={language}
          workflowMode={workflowMode}
          code={code}
          lastOutput={lastOutput}
          hasRunCode={hasRunCode}
          checks={checks}
          messages={messages}
          onReturnToWorkspace={() => setActiveView('workspace')}
        />
      )}
    </div>
  );
}

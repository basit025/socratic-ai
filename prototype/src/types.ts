export type Language = 'python' | 'javascript' | 'html';

export type WorkflowMode = 'run_first' | 'explain_first';

export type AppView = 'workspace' | 'norman' | 'requirements' | 'report';

export type NormanStageNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface CourseAssignment {
  id: string;
  courseUnit: string;
  title: string;
  language: Language;
  goalDescription: string;
  expectedOutcome: string;
  starterCode: string;
}

export interface ComprehensionChecks {
  goalClear: boolean;
  logicExplained: boolean;
  outputInterpreted: boolean;
  understandingVerified: boolean;
  professorSummary: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  hint?: string | null;
  stageLabel?: string;
  timestamp: string;
}

export interface HistoryEntry {
  role: 'user' | 'model';
  content: string;
}

export interface ApiChatResponse {
  reply: {
    normanStage: NormanStageNumber;
    stageLabel: string;
    nextStepInstruction: string;
    message: string;
    hint?: string | null;
    allowExecution: boolean;
    comprehensionChecks: ComprehensionChecks;
  };
  rawText: string;
}

export interface NormanStageMeta {
  stage: NormanStageNumber;
  phase: 'Goal' | 'Execution' | 'Evaluation';
  name: string;
  studentQuestion: string;
  uiSupport: string;
  professorValue: string;
}

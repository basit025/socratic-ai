/** Messages between the page and the Python runner worker. */
export type RunnerRequest =
  | { type: "init" }
  | { type: "run"; id: number; code: string }
  | { type: "tests"; id: number; code: string; calls: string[] };

export interface TestCallResult {
  call: string;
  ok: boolean;
  repr?: string;
  error?: string;
}

export type RunnerResponse =
  | { type: "ready" }
  | { type: "init_error"; message: string }
  | { type: "run_result"; id: number; ok: boolean; output: string; error?: string; durationMs: number }
  | { type: "test_result"; id: number; ok: boolean; results: TestCallResult[]; error?: string; durationMs: number };

export interface RunOutcome {
  ok: boolean;
  output: string;
  error?: string;
  durationMs: number;
  timedOut?: boolean;
}

export interface TestOutcome {
  ok: boolean;
  results: TestCallResult[];
  error?: string;
  durationMs: number;
  timedOut?: boolean;
}

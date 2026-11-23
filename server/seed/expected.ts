/**
 * Computes hidden-test expected values by RUNNING the reference solution (never typed by hand):
 * Python through Pyodide in Node, JavaScript through node:vm with the browser's own repr().
 * Per variant option, `{placeholders}` in the reference solution are filled first.
 */
import vm from "node:vm";
import { loadPyodide } from "pyodide";
import { repr } from "../../shared/repr.js";

type Fills = Record<string, Record<string, string>>;
const fill = (code: string, f?: Record<string, string>) => (f ? code.replace(/\{([a-z_]+)\}/g, (m, k: string) => f[k] ?? m) : code);

let py: Awaited<ReturnType<typeof loadPyodide>> | null = null;

async function runPython(code: string, calls: string[]): Promise<string[]> {
  py ??= await loadPyodide();
  const ns = py.globals.get("dict")();
  try {
    await py.runPythonAsync(code, { globals: ns });
    return calls.map((c) => String(py!.runPython(`repr(${c})`, { globals: ns })));
  } finally {
    ns.destroy();
  }
}

function runJs(code: string, calls: string[]): string[] {
  const ctx = vm.createContext({ console: { log() {} } });
  const values = vm.runInContext(`"use strict";\n${code}\n[${calls.map((c) => `(${c})`).join(",\n")}]`, ctx, { timeout: 2000 }) as unknown[];
  return values.map((v) => repr(v));
}

/** Returns tests with `expected` (a string, or a map per variant option when versions differ). */
export async function computeExpected(
  language: "python" | "javascript",
  reference: string,
  tests: { name: string; call: string }[],
  variants: { options: string[]; fills: Fills } | null,
): Promise<{ name: string; call: string; expected: string | Record<string, string> }[]> {
  const options = variants ? variants.options : [null];
  const perOption: Record<string, string[]> = {};
  for (const opt of options) {
    const code = fill(reference, opt != null ? variants!.fills[opt] : undefined);
    const calls = tests.map((t) => t.call);
    perOption[opt ?? "_"] = language === "python" ? await runPython(code, calls) : runJs(code, calls);
  }
  return tests.map((t, i) => {
    const vals = Object.fromEntries(Object.entries(perOption).map(([k, v]) => [k, v[i]!]));
    const distinct = new Set(Object.values(vals));
    return { ...t, expected: variants && distinct.size > 1 ? vals : Object.values(vals)[0]! };
  });
}

import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYSTEM_PROMPT = `You are Ustaad, a concise Socratic coding mentor modeled on Don Norman's Seven Stages of Action to help students learn and help professors trust authentic student work.

RULES:
- NEVER write or complete assignment code for the student.
- Reply in max 3 sentences (Roman Urdu + English, or matching the student's language) ending with ONE clear question.
- Workflow "run_first": student runs code first, sees output, then explains why it produced that output. Set allowExecution: true.
- Workflow "explain_first": student explains goal & plain-language logic first; set allowExecution: true only after logic is clear.
- Map each reply to Norman Stage 1-7 (1 Goal, 2 Intention, 3 Specify Action, 4 Execute, 5 Perceive State, 6 Interpret State, 7 Evaluate Outcome) with a 1-sentence nextStepInstruction.
- Set comprehensionChecks.understandingVerified: true only when the student both ran code and accurately explained how it works.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    normanStage: {
      type: Type.INTEGER,
      description: "Current stage from 1 to 7 in Don Norman's Seven Stages of Action",
    },
    stageLabel: {
      type: Type.STRING,
      description: "Short label for the current Norman stage, e.g. '6. Interpreting the State'",
    },
    nextStepInstruction: {
      type: Type.STRING,
      description: "One clear, actionable sentence telling the user what to do next",
    },
    message: {
      type: Type.STRING,
      description: "Ustaad's Socratic reply (max 3 sentences, ends with one clear question, never gives solution code)",
    },
    hint: {
      type: Type.STRING,
      nullable: true,
      description: "Optional brief conceptual hint without giving code",
    },
    allowExecution: {
      type: Type.BOOLEAN,
      description: "Whether code execution is unlocked/permitted at this stage",
    },
    comprehensionChecks: {
      type: Type.OBJECT,
      properties: {
        goalClear: { type: Type.BOOLEAN },
        logicExplained: { type: Type.BOOLEAN },
        outputInterpreted: { type: Type.BOOLEAN },
        understandingVerified: { type: Type.BOOLEAN },
        professorSummary: {
          type: Type.STRING,
          description: "Objective 1-2 sentence summary for the professor describing what the student demonstrated or still needs to explain",
        },
      },
      required: [
        "goalClear",
        "logicExplained",
        "outputInterpreted",
        "understandingVerified",
        "professorSummary",
      ],
    },
  },
  required: [
    "normanStage",
    "stageLabel",
    "nextStepInstruction",
    "message",
    "allowExecution",
    "comprehensionChecks",
  ],
};

interface HistoryEntry {
  role: "user" | "model";
  content: string;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "YOUR_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY is not configured. Please add it in the Settings > Secrets panel.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 35000,
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function parseGeminiError(error: unknown): { status: number; message: string } {
  const errObj = error as { status?: number; message?: string; name?: string };
  if (errObj?.name === "TimeoutError" || errObj?.name === "AbortError") {
    return {
      status: 504,
      message: "The AI mentor took too long to respond. Please try sending your message again.",
    };
  }

  let status =
    typeof errObj?.status === "number" && errObj.status >= 400 && errObj.status < 600
      ? errObj.status
      : 500;
  let message = errObj?.message || "Failed to generate response from Ustaad AI.";

  if (typeof message === "string" && message.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(message) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed?.error?.message) {
        message = parsed.error.message;
      }
      if (typeof parsed?.error?.code === "number" && parsed.error.code >= 400 && parsed.error.code < 600) {
        status = parsed.error.code;
      }
    } catch {
      // Keep original message if not JSON
    }
  }

  return { status, message };
}

async function generateWithRetry(
  ai: GoogleGenAI,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>,
  maxAttempts = 2
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema,
          abortSignal: AbortSignal.timeout(35000),
        },
      });
    } catch (err) {
      lastError = err;
      const { status, message } = parseGeminiError(err);
      const isTransient = status === 500 || status === 502 || status === 503 || status === 504;
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      console.warn(`Retrying gemini-3.1-flash-lite after transient ${status}: ${message}`);
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "1mb" }));

  app.post("/api/chat", async (req, res) => {
    try {
      const { history = [], userPrompt } = req.body as {
        history?: HistoryEntry[];
        userPrompt?: string;
      };

      if (!userPrompt || typeof userPrompt !== "string") {
        res.status(400).json({ error: "Missing userPrompt in request body." });
        return;
      }

      const ai = getGeminiClient();

      const recentHistory = Array.isArray(history) ? history.slice(-6) : [];
      const contents = [
        ...recentHistory.map((h) => ({
          role: h.role === "model" ? "model" : "user",
          parts: [{ text: String(h.content ?? "") }],
        })),
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ];

      const response = await generateWithRetry(ai, contents);

      const aiResponseText = (response.text ?? "").trim();
      if (!aiResponseText) {
        res.status(502).json({ error: "Empty response received from Ustaad AI model." });
        return;
      }

      const cleaned = aiResponseText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      const parsed = JSON.parse(cleaned);

      res.json({
        reply: parsed,
        rawText: aiResponseText,
      });
    } catch (error: unknown) {
      console.error("Error in /api/chat:", error);
      const { status, message } = parseGeminiError(error);
      if (status === 429) {
        res.status(429).json({
          error:
            "Free-tier rate limit reached for this API key. Wait a moment before retrying, or select a billing-enabled API key in Settings > Secrets for higher quota.",
        });
        return;
      }
      if (status === 400 || status === 403) {
        res.status(status).json({
          error: `API key issue (${status}): Please check or re-select your Gemini API key in Settings > Secrets.`,
        });
        return;
      }
      res.status(status).json({ error: message });
    }
  });

  app.all("/api/*", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
  });

  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith("/api/")) {
      const msg = err instanceof Error ? err.message : "Invalid API request.";
      res.status(400).json({ error: msg });
      return;
    }
    next(err);
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

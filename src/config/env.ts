import { config } from "dotenv";

config();

const truthyValues = new Set(["1", "true", "yes", "on"]);

function parseBoolean(raw: string | undefined, fallback = false): boolean {
  if (!raw) return fallback;
  return truthyValues.has(raw.trim().toLowerCase());
}

export const appEnv = {
  port: Number(process.env.PORT ?? 8787),
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  tracingEnabled:
    parseBoolean(process.env.LANGSMITH_TRACING, false) ||
    parseBoolean(process.env.LANGCHAIN_TRACING_V2, false),
  hasLangsmithKey: Boolean(process.env.LANGSMITH_API_KEY),
};

export function ensureTracingDefaults(): void {
  if (!process.env.LANGCHAIN_PROJECT) {
    process.env.LANGCHAIN_PROJECT = "pad-expand-agent-mvp";
  }
  if (appEnv.tracingEnabled && !process.env.LANGSMITH_TRACING) {
    process.env.LANGSMITH_TRACING = "true";
  }
  if (appEnv.tracingEnabled && !process.env.LANGCHAIN_TRACING_V2) {
    process.env.LANGCHAIN_TRACING_V2 = "true";
  }
}


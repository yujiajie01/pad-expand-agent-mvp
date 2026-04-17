import { config } from "dotenv";

config();

const truthyValues = new Set(["1", "true", "yes", "on"]);

function parseBoolean(raw: string | undefined, fallback = false): boolean {
  if (!raw) return fallback;
  return truthyValues.has(raw.trim().toLowerCase());
}

/** 敏感配置只从环境变量读取，勿在代码里写默认值 */
function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(
      `[config] 缺少环境变量 ${name}。请复制 .env.example 为 .env 并填写（不要将 .env 提交到 Git）。`,
    );
  }
  return v;
}

export const appEnv = {
  port: Number(process.env.PORT ?? 8787),
  /** HTTP 头 `X-Agent-Key`，与扩展 `padExpandAgentSecret` 一致；必须在 .env 中设置 WS_KEY */
  wsKey: requireEnv("WS_KEY"),
  /** 未设置 OPENAI_BASE_URL 时使用 OpenAI 官方接口；国内厂商需同时配置 Base URL */
  openAiBaseUrl: process.env.OPENAI_BASE_URL?.trim() || undefined,
  openAiModel: process.env.OPENAI_MODEL ?? "deepseek-chat",
  tracingEnabled:
    parseBoolean(process.env.LANGSMITH_TRACING, false) ||
    parseBoolean(process.env.LANGCHAIN_TRACING_V2, false),
  hasLangsmithKey: Boolean(process.env.LANGSMITH_API_KEY),
  // Langfuse
  langfusePublicKey: process.env.LANGFUSE_PUBLIC_KEY?.trim() || undefined,
  langfuseSecretKey: process.env.LANGFUSE_SECRET_KEY?.trim() || undefined,
  langfuseHost: process.env.LANGFUSE_HOST?.trim() || "http://localhost:3000",
  // Temporal
  temporalAddress: process.env.TEMPORAL_ADDRESS?.trim() || "localhost:7233",
  temporalNamespace: process.env.TEMPORAL_NAMESPACE?.trim() || "default",
  useTemporalWorker: parseBoolean(process.env.USE_TEMPORAL_WORKER, false),
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


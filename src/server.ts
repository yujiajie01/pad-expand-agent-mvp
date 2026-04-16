/**
 * 简单 HTTP + JSON（扩展宿主无 WebSocket 时用此协议）。
 * - `GET /`：健康检查。
 * - 聊天接口：`POST/GET`，`Content-Type: application/json`，成功为 JSON 对象；错误为 `{ error: string }`。
 * - 鉴权：请求头 `X-Agent-Key`（与 `WS_KEY` / 默认 `nikoyu` 一致）。
 */
import type { Context } from "hono";

import { Hono } from "hono";

import { cors } from "hono/cors";

import { appEnv, ensureTracingDefaults } from "./config/env";

import { createAgentGraph } from "./graph/agentGraph";

import { createInitialState } from "./graph/state";

import { MemorySessionStore } from "./session/memoryStore";

ensureTracingDefaults();

const app = new Hono();

app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS", "HEAD"],
    allowHeaders: ["Content-Type", "ngrok-skip-browser-warning", "Accept", "X-Agent-Key"],
  }),
);

const graph = createAgentGraph();

const store = new MemorySessionStore();

function agentKeyOk(c: Context): boolean {
  const key = c.req.header("x-agent-key") ?? c.req.header("X-Agent-Key") ?? "";
  return key === appEnv.wsKey;
}

function unauthorized(c: Context) {
  return c.json({ error: "unauthorized" }, 401);
}

app.get("/", (c) => {
  return c.json({
    name: "pad-expand-agent-mvp",
    status: "ok",
    tracingEnabled: appEnv.tracingEnabled,
    hasLangsmithKey: appEnv.hasLangsmithKey,
  });
});

app.post("/chat/start", async (c) => {
  if (!agentKeyOk(c)) {
    return unauthorized(c);
  }
  const session = store.createSession(createInitialState());
  const reply = session.state.assistantReply;
  return c.json({
    sessionId: session.id,
    reply,
    state: session.state,
  });
});

app.post("/chat/turn", async (c) => {
  if (!agentKeyOk(c)) {
    return unauthorized(c);
  }
  const body = await c.req.json<{
    sessionId?: string;
    input?: string;
  }>();

  if (!body.sessionId || !body.input) {
    return c.json({ error: "sessionId 和 input 为必填。" }, 400);
  }

  const session = store.getSession(body.sessionId);
  if (!session) {
    return c.json({ error: "会话不存在，请先调用 /chat/start。" }, 404);
  }

  const nextState = await graph.invoke({
    ...session.state,
    latestUserInput: body.input,
    userConfirmed: false,
  });

  store.updateState(session.id, nextState);
  const reply = nextState.assistantReply;

  return c.json({
    sessionId: session.id,
    status: nextState.status,
    reply,
    normalized: nextState.normalized,
    missingFields: nextState.missingFields,
    errors: nextState.errors,
    slots: nextState.slots,
  });
});

app.get("/chat/:sessionId/state", (c) => {
  if (!agentKeyOk(c)) {
    return unauthorized(c);
  }
  const sessionId = c.req.param("sessionId");
  const session = store.getSession(sessionId);
  if (!session) {
    return c.json({ error: "会话不存在。" }, 404);
  }

  return c.json({
    sessionId: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    state: session.state,
  });
});

app.post("/chat/:sessionId/confirm", async (c) => {
  if (!agentKeyOk(c)) {
    return unauthorized(c);
  }
  const sessionId = c.req.param("sessionId");
  const session = store.getSession(sessionId);
  if (!session) {
    return c.json({ error: "会话不存在。" }, 404);
  }

  const nextState = await graph.invoke({
    ...session.state,
    latestUserInput: "确认",
    userConfirmed: false,
  });

  store.updateState(session.id, nextState);
  const reply = nextState.assistantReply;

  return c.json({
    sessionId: session.id,
    status: nextState.status,
    reply,
    normalized: nextState.normalized,
  });
});

export default {
  port: appEnv.port,
  fetch: app.fetch,
};

if (import.meta.main) {
  console.log(
    `[pad-expand-agent-mvp] http://127.0.0.1:${appEnv.port}  JSON API  X-Agent-Key=${appEnv.wsKey}  (tracing=${String(
      appEnv.tracingEnabled,
    )})`,
  );
}

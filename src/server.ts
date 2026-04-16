/**
 * 路由约定：
 * - `GET /`：健康检查，`application/json`。
 * - `GET /ws?key=<WS_KEY>`：握手鉴权后升级为 WebSocket；消息为 JSON 文本帧（见 `handleClientMessage`）。
 * - 密钥：`WS_KEY` 环境变量，默认 `nikoyu`。
 */
import type { ServerWebSocket } from "bun";

import { Hono } from "hono";

import { cors } from "hono/cors";

import { appEnv, ensureTracingDefaults } from "./config/env";

import { createAgentGraph } from "./graph/agentGraph";

import { createInitialState } from "./graph/state";

import { MemorySessionStore } from "./session/memoryStore";

ensureTracingDefaults();

type WsData = Record<string, never>;

const WS_PATH = "/ws";

const app = new Hono();

app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS", "HEAD"],
    allowHeaders: ["Content-Type", "ngrok-skip-browser-warning", "Accept"],
  }),
);

const graph = createAgentGraph();

const store = new MemorySessionStore();

app.get("/", (c) => {
  return c.json({
    name: "pad-expand-agent-mvp",
    status: "ok",
    protocol: "websocket",
    wsPath: WS_PATH,
    wsKeyQuery: "key",
    tracingEnabled: appEnv.tracingEnabled,
    hasLangsmithKey: appEnv.hasLangsmithKey,
  });
});

function sendJson(ws: ServerWebSocket<WsData>, obj: unknown): void {
  ws.send(JSON.stringify(obj));
}

function wsMessageToString(message: string | ArrayBuffer | ArrayBufferView): string {
  if (typeof message === "string") {
    return message;
  }
  if (message instanceof ArrayBuffer) {
    return new TextDecoder().decode(message);
  }
  const v = message as ArrayBufferView;
  return new TextDecoder().decode(
    v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength),
  );
}

async function handleClientMessage(
  ws: ServerWebSocket<WsData>,
  raw: string,
): Promise<void> {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(raw) as Record<string, unknown>;
  }
  catch {
    sendJson(ws, { ok: false, error: "invalid json", httpStatus: 400 });
    return;
  }

  const id = msg.id;
  if (typeof id !== "number") {
    sendJson(ws, { ok: false, error: "missing id", httpStatus: 400 });
    return;
  }

  const type = msg.type;
  if (typeof type !== "string") {
    sendJson(ws, { id, ok: false, error: "missing type", httpStatus: 400 });
    return;
  }

  try {
    if (type === "chat/start") {
      const session = store.createSession(createInitialState());
      const reply = session.state.assistantReply;
      sendJson(ws, {
        id,
        ok: true,
        data: {
          sessionId: session.id,
          reply,
          state: session.state,
        },
      });
      return;
    }

    if (type === "chat/turn") {
      const sessionId = msg.sessionId;
      const input = msg.input;
      if (typeof sessionId !== "string" || typeof input !== "string") {
        sendJson(ws, { id, ok: false, error: "sessionId 和 input 为必填。", httpStatus: 400 });
        return;
      }
      const session = store.getSession(sessionId);
      if (!session) {
        sendJson(ws, { id, ok: false, error: "会话不存在，请先调用 chat/start。", httpStatus: 404 });
        return;
      }
      const nextState = await graph.invoke({
        ...session.state,
        latestUserInput: input,
        userConfirmed: false,
      });
      store.updateState(session.id, nextState);
      const reply = nextState.assistantReply;
      sendJson(ws, {
        id,
        ok: true,
        data: {
          sessionId: session.id,
          status: nextState.status,
          reply,
          normalized: nextState.normalized,
          missingFields: nextState.missingFields,
          errors: nextState.errors,
          slots: nextState.slots,
        },
      });
      return;
    }

    if (type === "chat/state") {
      const sessionId = msg.sessionId;
      if (typeof sessionId !== "string") {
        sendJson(ws, { id, ok: false, error: "sessionId 必填。", httpStatus: 400 });
        return;
      }
      const session = store.getSession(sessionId);
      if (!session) {
        sendJson(ws, { id, ok: false, error: "会话不存在。", httpStatus: 404 });
        return;
      }
      sendJson(ws, {
        id,
        ok: true,
        data: {
          sessionId: session.id,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          state: session.state,
        },
      });
      return;
    }

    if (type === "chat/confirm") {
      const sessionId = msg.sessionId;
      if (typeof sessionId !== "string") {
        sendJson(ws, { id, ok: false, error: "sessionId 必填。", httpStatus: 400 });
        return;
      }
      const session = store.getSession(sessionId);
      if (!session) {
        sendJson(ws, { id, ok: false, error: "会话不存在。", httpStatus: 404 });
        return;
      }
      const nextState = await graph.invoke({
        ...session.state,
        latestUserInput: "确认",
        userConfirmed: false,
      });
      store.updateState(session.id, nextState);
      const reply = nextState.assistantReply;
      sendJson(ws, {
        id,
        ok: true,
        data: {
          sessionId: session.id,
          status: nextState.status,
          reply,
          normalized: nextState.normalized,
        },
      });
      return;
    }

    sendJson(ws, { id, ok: false, error: `unknown type: ${type}`, httpStatus: 400 });
  }
  catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    sendJson(ws, { id, ok: false, error: err, httpStatus: 500 });
  }
}

export default {
  port: appEnv.port,
  fetch(req: Request, server: { upgrade: (req: Request, options: { data: WsData }) => boolean }) {
    const url = new URL(req.url);
    if (url.pathname !== WS_PATH) {
      return app.fetch(req);
    }

    const key = url.searchParams.get("key");
    if (key !== appEnv.wsKey) {
      return new Response(JSON.stringify({ error: "invalid key" }), {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const upgraded = server.upgrade(req, { data: {} });
    if (upgraded) {
      return undefined;
    }
    return new Response("WebSocket upgrade failed", { status: 500 });
  },
  websocket: {
    open() {},
    async message(ws: ServerWebSocket<WsData>, message: string | Buffer) {
      const raw = wsMessageToString(message as string | ArrayBuffer | ArrayBufferView);
      await handleClientMessage(ws, raw);
    },
  },
};

if (import.meta.main) {
  console.log(
    `[pad-expand-agent-mvp] listening on http://127.0.0.1:${appEnv.port} (tracing=${String(
      appEnv.tracingEnabled,
    )})  ws: ${WS_PATH}?key=***`,
  );
}

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
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);
const graph = createAgentGraph();
const store = new MemorySessionStore();

app.get("/", (c) => {
  return c.json({
    name: "pad-expand-agent-mvp",
    status: "ok",
    tracingEnabled: appEnv.tracingEnabled,
    hasLangsmithKey: appEnv.hasLangsmithKey,
  });
});

app.post("/chat/start", async (c) => {
  const session = store.createSession(createInitialState());
  return c.json({
    sessionId: session.id,
    reply: session.state.assistantReply,
    state: session.state,
  });
});

app.post("/chat/turn", async (c) => {
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

  return c.json({
    sessionId: session.id,
    status: nextState.status,
    reply: nextState.assistantReply,
    normalized: nextState.normalized,
    missingFields: nextState.missingFields,
    errors: nextState.errors,
    slots: nextState.slots,
  });
});

app.get("/chat/:sessionId/state", (c) => {
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
  return c.json({
    sessionId: session.id,
    status: nextState.status,
    reply: nextState.assistantReply,
    normalized: nextState.normalized,
  });
});

export default {
  port: appEnv.port,
  fetch: app.fetch,
};

if (import.meta.main) {
  console.log(
    `[pad-expand-agent-mvp] listening on http://127.0.0.1:${appEnv.port} (tracing=${String(
      appEnv.tracingEnabled,
    )})`,
  );
}


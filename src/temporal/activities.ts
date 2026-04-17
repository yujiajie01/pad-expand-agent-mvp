import { createAgentGraph } from "../graph/agentGraph";
import type { AgentState } from "../graph/state";
import { makeLangfuseCallback } from "../tracing/langfuse";

const graph = createAgentGraph();

export async function runGraphActivity(
  state: AgentState,
  requestId?: string,
): Promise<AgentState> {
  const cb = makeLangfuseCallback(requestId);
  const result = await graph.invoke(
    { ...state },
    cb ? { callbacks: [cb] } : undefined,
  );
  return result as AgentState;
}

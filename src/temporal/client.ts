import { Connection, WorkflowClient } from "@temporalio/client";
import { appEnv } from "../config/env";
import type { AgentState } from "../graph/state";
import { chatTurnWorkflow } from "./workflows";

let _client: WorkflowClient | undefined;

async function getClient(): Promise<WorkflowClient> {
  if (_client) return _client;
  const connection = await Connection.connect({ address: appEnv.temporalAddress });
  _client = new WorkflowClient({
    connection,
    namespace: appEnv.temporalNamespace,
  });
  return _client;
}

export async function runChatTurnWorkflow(
  state: AgentState,
  requestId?: string,
): Promise<AgentState> {
  const client = await getClient();
  const handle = await client.start(chatTurnWorkflow, {
    args: [state, requestId],
    taskQueue: "pad-expand-agent",
    workflowId: `chat-turn-${requestId ?? Date.now()}`,
  });
  return handle.result();
}

import { proxyActivities } from "@temporalio/workflow";
import type { AgentState } from "../graph/state";
import type * as acts from "./activities";

const { runGraphActivity } = proxyActivities<typeof acts>({
  startToCloseTimeout: "60 seconds",
  retry: { maximumAttempts: 2 },
});

export async function chatTurnWorkflow(
  state: AgentState,
  requestId?: string,
): Promise<AgentState> {
  return runGraphActivity(state, requestId);
}

import { END, START, StateGraph } from "@langchain/langgraph";
import {
  askMissingNode,
  confirmNode,
  finalizeNode,
  normalizeAndValidateNode,
  parseUserInputNode,
} from "./nodes";
import { AgentStateAnnotation, type AgentState } from "./state";

function routeAfterNormalize(state: AgentState): string {
  if (state.errors.length > 0) {
    return "askMissingNode";
  }
  if (state.missingFields.length > 0) {
    return "askMissingNode";
  }
  if (state.userConfirmed && state.normalized) {
    return "finalizeNode";
  }
  return "confirmNode";
}

export function createAgentGraph() {
  const graph = new StateGraph(AgentStateAnnotation)
    .addNode("parseUserInputNode", parseUserInputNode)
    .addNode("normalizeAndValidateNode", normalizeAndValidateNode)
    .addNode("askMissingNode", askMissingNode)
    .addNode("confirmNode", confirmNode)
    .addNode("finalizeNode", finalizeNode)
    .addEdge(START, "parseUserInputNode")
    .addEdge("parseUserInputNode", "normalizeAndValidateNode")
    .addConditionalEdges("normalizeAndValidateNode", routeAfterNormalize, [
      "askMissingNode",
      "confirmNode",
      "finalizeNode",
    ])
    .addEdge("askMissingNode", END)
    .addEdge("confirmNode", END)
    .addEdge("finalizeNode", END);

  return graph.compile();
}


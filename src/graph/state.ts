import { Annotation } from "@langchain/langgraph";
import type { NormalizedConfig, OutputKind } from "../domain/schema";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type SlotState = {
  outputKind?: OutputKind;
  expValue?: number;
  unit?: "mil" | "mm";
  continuous?: boolean;
};

export type AgentStatus = "collecting" | "confirming" | "completed" | "error";

export type AgentState = {
  messages: ChatMessage[];
  slots: SlotState;
  normalized: NormalizedConfig | null;
  missingFields: string[];
  errors: string[];
  status: AgentStatus;
  latestUserInput: string;
  assistantReply: string;
  userConfirmed: boolean;
};

export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<ChatMessage[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
  slots: Annotation<SlotState>({
    reducer: (left, right) => ({ ...left, ...right }),
    default: () => ({}),
  }),
  normalized: Annotation<NormalizedConfig | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  missingFields: Annotation<string[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  errors: Annotation<string[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  status: Annotation<AgentStatus>({
    reducer: (_left, right) => right,
    default: () => "collecting",
  }),
  latestUserInput: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
  assistantReply: Annotation<string>({
    reducer: (_left, right) => right,
    default: () => "",
  }),
  userConfirmed: Annotation<boolean>({
    reducer: (_left, right) => right,
    default: () => false,
  }),
});

export function createInitialState(): AgentState {
  return {
    messages: [],
    slots: {},
    normalized: null,
    missingFields: [],
    errors: [],
    status: "collecting",
    latestUserInput: "",
    assistantReply:
      "你好，我是焊盘外扩助手。请告诉我：生成类型、外扩值（mm 或 mil）和是否连续生成。",
    userConfirmed: false,
  };
}


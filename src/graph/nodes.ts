import { formatOutputKind, normalizeSlots } from "../domain/schema";
import { extractFieldsFromText } from "../llm/extractor";
import type { AgentState } from "./state";

function buildMissingPrompt(missingFields: string[], errors: string[]): string {
  const labels: Record<string, string> = {
    outputKind: "生成类型（禁止铺铜 / 禁止填充 / 仅阻焊层）",
    expValue: "外扩值（支持 mm 或 mil）",
    continuous: "连续模式（是/否）",
  };
  const missing = missingFields.map((field) => labels[field] ?? field);

  const lines = ["我还需要以下信息："];
  if (missing.length > 0) {
    lines.push(`- ${missing.join("；")}`);
  }
  if (errors.length > 0) {
    lines.push(`- 校验问题：${errors.join("；")}`);
  }
  lines.push("示例：阻焊区域，外扩 0.1mm，连续生成。");
  return lines.join("\n");
}

function buildConfirmPrompt(state: AgentState): string {
  if (!state.normalized) {
    return "参数还不完整，请继续补充。";
  }
  return [
    "请确认本次参数：",
    `- 生成类型：${formatOutputKind(state.normalized.outputKind)}`,
    `- 外扩：${state.normalized.expMil} mil`,
    `- 连续生成：${state.normalized.continuous ? "是" : "否"}`,
    "回复“确认”即可完成；也可以直接说要修改的项。",
  ].join("\n");
}

export async function parseUserInputNode(state: AgentState): Promise<Partial<AgentState>> {
  const input = state.latestUserInput.trim();
  if (!input) {
    return {};
  }

  const extracted = await extractFieldsFromText(input);
  const nextSlots = {
    ...state.slots,
    ...(extracted.outputKind ? { outputKind: extracted.outputKind } : {}),
    ...(typeof extracted.expValue === "number" ? { expValue: extracted.expValue } : {}),
    ...(extracted.unit ? { unit: extracted.unit } : {}),
    ...(typeof extracted.continuous === "boolean"
      ? { continuous: extracted.continuous }
      : {}),
  };

  return {
    slots: nextSlots,
    userConfirmed: Boolean(extracted.userConfirmed),
    messages: [{ role: "user", content: input }],
  };
}

export function normalizeAndValidateNode(state: AgentState): Partial<AgentState> {
  const normalized = normalizeSlots(state.slots);
  return {
    normalized: normalized.normalized,
    missingFields: normalized.missingFields,
    errors: normalized.errors,
    status: normalized.errors.length > 0 ? "error" : "collecting",
  };
}

export function askMissingNode(state: AgentState): Partial<AgentState> {
  const prompt = buildMissingPrompt(state.missingFields, state.errors);
  return {
    assistantReply: prompt,
    status: "collecting",
    messages: [{ role: "assistant", content: prompt }],
  };
}

export function confirmNode(state: AgentState): Partial<AgentState> {
  const prompt = buildConfirmPrompt(state);
  return {
    assistantReply: prompt,
    status: "confirming",
    messages: [{ role: "assistant", content: prompt }],
  };
}

export function finalizeNode(state: AgentState): Partial<AgentState> {
  if (!state.normalized) {
    const fallback = "参数未完整，无法完成。请补充后再确认。";
    return {
      assistantReply: fallback,
      status: "error",
      messages: [{ role: "assistant", content: fallback }],
    };
  }
  const payload = JSON.stringify(state.normalized, null, 2);
  const reply = `已确认，输出参数如下：\n${payload}`;
  return {
    assistantReply: reply,
    status: "completed",
    messages: [{ role: "assistant", content: reply }],
  };
}


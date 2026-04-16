import { z } from "zod";

export const MAX_EXP_MIL = 2000;
export const MM_TO_MIL = 39.37007874015748;

export const outputKindSchema = z.enum([
  "forbidden_pour",
  "forbidden_fill",
  "solder_mask",
]);

export const normalizedConfigSchema = z.object({
  outputKind: outputKindSchema,
  expMil: z.number().gt(0).lte(MAX_EXP_MIL),
  continuous: z.boolean(),
});

export type OutputKind = z.infer<typeof outputKindSchema>;
export type NormalizedConfig = z.infer<typeof normalizedConfigSchema>;

export type SlotInput = {
  outputKind?: OutputKind;
  expValue?: number;
  unit?: "mil" | "mm";
  continuous?: boolean;
};

export type NormalizeResult = {
  normalized: NormalizedConfig | null;
  missingFields: string[];
  errors: string[];
};

export function normalizeOutputKind(raw?: string): OutputKind | undefined {
  if (!raw) return undefined;
  const text = raw.trim().toLowerCase();
  if (
    text.includes("铺铜") ||
    text.includes("pour") ||
    text.includes("forbidden_pour") ||
    text.includes("禁止区域") ||
    text.includes("默认")
  ) {
    return "forbidden_pour";
  }
  if (
    text.includes("填充") ||
    text.includes("forbidden_fill") ||
    text.includes("铜皮填充")
  ) {
    return "forbidden_fill";
  }
  if (
    text.includes("阻焊") ||
    text.includes("mask") ||
    text.includes("solder_mask")
  ) {
    return "solder_mask";
  }
  return undefined;
}

export function parseContinuous(raw?: string): boolean | undefined {
  if (!raw) return undefined;
  const text = raw.trim().toLowerCase();
  if (
    text.includes("不连续") ||
    text.includes("单次") ||
    text.includes("一次") ||
    text.includes("关闭连续") ||
    text.includes("关闭") ||
    text.includes("关掉") ||
    text.includes("不要连续")
  ) {
    return false;
  }
  if (
    text.includes("连续") ||
    text.includes("持续") ||
    text.includes("多次") ||
    text.includes("开启连续")
  ) {
    return true;
  }
  return undefined;
}

export function toMil(value: number, unit: "mil" | "mm"): number {
  return unit === "mm" ? value * MM_TO_MIL : value;
}

export function roundMil(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function normalizeSlots(slots: SlotInput): NormalizeResult {
  const missingFields: string[] = [];
  const errors: string[] = [];

  if (!slots.outputKind) {
    missingFields.push("outputKind");
  }
  if (typeof slots.expValue !== "number" || Number.isNaN(slots.expValue)) {
    missingFields.push("expValue");
  }
  if (typeof slots.continuous !== "boolean") {
    missingFields.push("continuous");
  }

  if (missingFields.length > 0) {
    return { normalized: null, missingFields, errors };
  }

  const unit = slots.unit ?? "mil";
  const expMil = roundMil(toMil(slots.expValue as number, unit));

  if (expMil <= 0) {
    errors.push("外扩值必须大于 0。");
  }
  if (expMil > MAX_EXP_MIL) {
    errors.push(`外扩值超出上限，需小于等于 ${MAX_EXP_MIL} mil。`);
  }

  const candidate: NormalizedConfig = {
    outputKind: slots.outputKind as OutputKind,
    expMil,
    continuous: slots.continuous as boolean,
  };
  const check = normalizedConfigSchema.safeParse(candidate);
  if (!check.success) {
    errors.push(...check.error.issues.map((issue) => issue.message));
  }

  if (errors.length > 0) {
    return { normalized: null, missingFields: [], errors };
  }

  return { normalized: candidate, missingFields: [], errors: [] };
}

export function formatOutputKind(kind: OutputKind): string {
  switch (kind) {
    case "forbidden_pour":
      return "禁止区域（禁止铺铜）";
    case "forbidden_fill":
      return "禁止区域（禁止填充）";
    case "solder_mask":
      return "阻焊区域（仅阻焊层）";
    default:
      return kind;
  }
}


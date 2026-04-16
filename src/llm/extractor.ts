import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { appEnv } from "../config/env";
import {
  normalizeOutputKind,
  parseContinuous,
  type OutputKind,
} from "../domain/schema";
import { extractionSystemPrompt } from "../prompts/systemPrompt";

export type ExtractedFields = {
  outputKind?: OutputKind;
  expValue?: number;
  unit?: "mil" | "mm";
  continuous?: boolean;
  userConfirmed?: boolean;
};

const extractionSchema = z.object({
  outputKind: z.enum(["forbidden_pour", "forbidden_fill", "solder_mask"]).nullable(),
  expValue: z.number().nullable(),
  unit: z.enum(["mil", "mm"]).nullable(),
  continuous: z.boolean().nullable(),
  userConfirmed: z.boolean().nullable(),
});

const confirmRegex = /(确认|就这样|可以执行|没问题|ok|okay|yes|是的|对的)/i;

function regexExtract(text: string): ExtractedFields {
  const lower = text.toLowerCase();
  const result: ExtractedFields = {};

  const mappedKind = normalizeOutputKind(text);
  if (mappedKind) {
    result.outputKind = mappedKind;
  }

  const cont = parseContinuous(text);
  if (typeof cont === "boolean") {
    result.continuous = cont;
  }

  if (confirmRegex.test(lower)) {
    result.userConfirmed = true;
  }

  const match = text.match(/(-?\d+(?:\.\d+)?)\s*(mm|mil|毫米)?/i);
  if (match) {
    const value = Number(match[1]);
    if (!Number.isNaN(value)) {
      result.expValue = value;
      const rawUnit = (match[2] ?? "").toLowerCase();
      if (rawUnit === "mm" || rawUnit === "毫米") {
        result.unit = "mm";
      }
      if (rawUnit === "mil") {
        result.unit = "mil";
      }
    }
  }

  return result;
}

export async function extractFieldsFromText(text: string): Promise<ExtractedFields> {
  const hasModelKey = Boolean(process.env.OPENAI_API_KEY);
  if (!hasModelKey) {
    return regexExtract(text);
  }

  try {
    const model = new ChatOpenAI({
      model: appEnv.openAiModel,
      temperature: 0,
      ...(appEnv.openAiBaseUrl && {
        configuration: { baseURL: appEnv.openAiBaseUrl },
      }),
    });
    const extractor = model.withStructuredOutput(extractionSchema, {
      name: "pad_expansion_params",
    });
    const structured = await extractor.invoke([
      { role: "system", content: extractionSystemPrompt },
      { role: "user", content: text },
    ]);

    return {
      outputKind: structured.outputKind ?? undefined,
      expValue: structured.expValue ?? undefined,
      unit: structured.unit ?? undefined,
      continuous: structured.continuous ?? undefined,
      userConfirmed: structured.userConfirmed ?? undefined,
    };
  } catch {
    return regexExtract(text);
  }
}


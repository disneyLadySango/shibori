import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { buildEvaluationPrompt, buildProjectionPrompt, deskEvaluationSchema, projectionSchema } from "./shibori";
import type { DeskEvaluation, GapEntry, Projection, UserContext } from "./types";

export async function projectMaterial(input: {
  context: UserContext;
  material: string;
  gaps: GapEntry[];
}): Promise<Projection> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: "gpt-5.6",
    input: [
      { role: "system", content: "出力スキーマに厳密に従い、日本語で教材を編集してください。" },
      { role: "user", content: buildProjectionPrompt(input) },
    ],
    text: { format: zodTextFormat(projectionSchema, "shibori_projection") },
  });

  if (!response.output_parsed) throw new Error("GPT-5.6 did not return a projection.");
  return { ...response.output_parsed, source: "gpt-5.6" };
}

export async function evaluateDeskAnswer(input: {
  context: UserContext;
  problem: string;
  answer: string;
}): Promise<DeskEvaluation> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: "gpt-5.6",
    input: [
      { role: "system", content: "学習者の回答を日本語で評価し、指定スキーマへ厳密に従ってください。" },
      { role: "user", content: buildEvaluationPrompt(input) },
    ],
    text: { format: zodTextFormat(deskEvaluationSchema, "shibori_desk_evaluation") },
  });
  if (!response.output_parsed) throw new Error("GPT-5.6 did not return an evaluation.");
  return { ...response.output_parsed, source: "gpt-5.6" };
}

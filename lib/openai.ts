import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { buildEvaluationPrompt, buildProjectionPrompt, deskEvaluationSchema, normalizeProjection, projectionOutputSchema } from "./shibori";
import { buildCheckPrompt, buildLearningPlanPrompt, learningPlanSchema, understandingCheckSchema } from "./planning";
import { buildPurposeRecommendationPrompt, purposeRecommendationOutputSchema } from "./prioritization";
import type { DeskEvaluation, FocusResource, GapEntry, LearningPlanProposal, LearningPortfolio, LearningPosition, LearningState, Projection, PurposeRecommendation, UnderstandingCheckResult, UserContext } from "./types";
import { languageInstruction, type DialogLanguage } from "./i18n";

export async function recommendLearningPurpose(input: {
  portfolio: LearningPortfolio;
  availableFocus: string;
  language?: DialogLanguage;
}): Promise<PurposeRecommendation> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: "gpt-5.6",
    input: [
      { role: "system", content: `学習者の最終選択を奪わず、複数の学習目的から理由つきのおすすめを一つだけ返してください。${languageInstruction(input.language ?? "ja")}` },
      { role: "user", content: buildPurposeRecommendationPrompt(input.portfolio, input.availableFocus) },
    ],
    text: { format: zodTextFormat(purposeRecommendationOutputSchema, "shibori_purpose_recommendation") },
  });

  if (!response.output_parsed) throw new Error("GPT-5.6 did not return a purpose recommendation.");
  if (!input.portfolio.purposes.some((state) => state.purpose.id === response.output_parsed?.purposeId)) {
    throw new Error("GPT-5.6 recommended an unknown learning purpose.");
  }
  return response.output_parsed;
}

export async function planLearning(input: {
  state: LearningState;
  material?: string;
  language?: DialogLanguage;
}): Promise<LearningPlanProposal> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: "gpt-5.6",
    input: [
      { role: "system", content: `学習者の意思決定を奪わず、次に集中する一つを提案してください。${languageInstruction(input.language ?? "ja")}` },
      { role: "user", content: buildLearningPlanPrompt(input) },
    ],
    text: { format: zodTextFormat(learningPlanSchema, "shibori_learning_plan") },
  });

  if (!response.output_parsed) throw new Error("GPT-5.6 did not return a learning plan.");
  return response.output_parsed;
}

export async function checkUnderstanding(input: {
  state: LearningState;
  prompt: string;
  answer: string;
  language?: DialogLanguage;
}): Promise<UnderstandingCheckResult> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: "gpt-5.6",
    input: [
      { role: "system", content: `学習者が今できることを回答だけから判定してください。${languageInstruction(input.language ?? "ja")}` },
      { role: "user", content: buildCheckPrompt(input) },
    ],
    text: { format: zodTextFormat(understandingCheckSchema, "shibori_understanding_check") },
  });

  if (!response.output_parsed) throw new Error("GPT-5.6 did not return an understanding check.");
  return response.output_parsed;
}

export async function projectMaterial(input: {
  context: UserContext;
  material: string;
  gaps: GapEntry[];
  focusResource: FocusResource;
  learningPosition: LearningPosition;
  language?: DialogLanguage;
}): Promise<Projection> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: "gpt-5.6",
    input: [
      { role: "system", content: `出力スキーマに厳密に従い教材を編集してください。${languageInstruction(input.language ?? "ja")}` },
      { role: "user", content: buildProjectionPrompt(input) },
    ],
    text: { format: zodTextFormat(projectionOutputSchema, "shibori_projection") },
  });

  if (!response.output_parsed) throw new Error("GPT-5.6 did not return a projection.");
  return { ...normalizeProjection(response.output_parsed), source: "gpt-5.6" };
}

export async function evaluateDeskAnswer(input: {
  context: UserContext;
  problem: string;
  answer: string;
  language?: DialogLanguage;
}): Promise<DeskEvaluation> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: "gpt-5.6",
    input: [
      { role: "system", content: `学習者の回答を評価し、指定スキーマへ厳密に従ってください。${languageInstruction(input.language ?? "ja")}` },
      { role: "user", content: buildEvaluationPrompt(input) },
    ],
    text: { format: zodTextFormat(deskEvaluationSchema, "shibori_desk_evaluation") },
  });
  if (!response.output_parsed) throw new Error("GPT-5.6 did not return an evaluation.");
  return { ...response.output_parsed, source: "gpt-5.6" };
}

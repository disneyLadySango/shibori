import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { buildEvaluationPrompt, buildProjectionPrompt, deskEvaluationSchema, projectionSchema } from "./shibori";
import { buildCheckPrompt, buildLearningPlanPrompt, learningPlanSchema, understandingCheckSchema } from "./planning";
import { buildPurposeRecommendationPrompt, purposeRecommendationOutputSchema } from "./prioritization";
import type { DeskEvaluation, GapEntry, LearningPlanProposal, LearningPortfolio, LearningState, Projection, PurposeRecommendation, UnderstandingCheckResult, UserContext } from "./types";

export async function recommendLearningPurpose(input: {
  portfolio: LearningPortfolio;
  availableFocus: string;
}): Promise<PurposeRecommendation> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: "gpt-5.6",
    input: [
      { role: "system", content: "学習者の最終選択を奪わず、複数の学習目的から理由つきのおすすめを一つだけ日本語で返してください。" },
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
}): Promise<LearningPlanProposal> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: "gpt-5.6",
    input: [
      { role: "system", content: "学習者の意思決定を奪わず、次に集中する一つを日本語で提案してください。" },
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
}): Promise<UnderstandingCheckResult> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: "gpt-5.6",
    input: [
      { role: "system", content: "学習者が今できることを回答だけから判定し、日本語で返してください。" },
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

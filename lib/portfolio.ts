import { z } from "zod";

import { learningStateSchema } from "./learning";
import type { LearningPortfolio, LearningState, PurposeRecommendation } from "./types";

export const purposeRecommendationSchema = z.object({
  purposeId: z.string(),
  reason: z.string(),
  basis: z.array(z.string()),
});

export const learningPortfolioSchema = z.object({
  version: z.literal(3),
  purposes: z.array(learningStateSchema).min(1),
  selectedPurposeId: z.string(),
  recommendation: purposeRecommendationSchema.nullable(),
  updatedAt: z.string(),
}).superRefine((portfolio, context) => {
  const ids = portfolio.purposes.map((state) => state.purpose.id);
  if (!ids.includes(portfolio.selectedPurposeId)) {
    context.addIssue({ code: "custom", message: "Selected purpose must exist.", path: ["selectedPurposeId"] });
  }
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", message: "Purpose ids must be unique.", path: ["purposes"] });
  }
  if (portfolio.recommendation && !ids.includes(portfolio.recommendation.purposeId)) {
    context.addIssue({ code: "custom", message: "Recommended purpose must exist.", path: ["recommendation", "purposeId"] });
  }
});

function now() {
  return new Date().toISOString();
}

export function createPortfolio(initial: LearningState): LearningPortfolio {
  return {
    version: 3,
    purposes: [initial],
    selectedPurposeId: initial.purpose.id,
    recommendation: null,
    updatedAt: now(),
  };
}

export function addLearningPurpose(portfolio: LearningPortfolio, state: LearningState): LearningPortfolio {
  if (portfolio.purposes.some((item) => item.purpose.id === state.purpose.id)) return portfolio;
  return { ...portfolio, purposes: [...portfolio.purposes, state], updatedAt: now() };
}

export function updateLearningPurpose(portfolio: LearningPortfolio, state: LearningState): LearningPortfolio {
  if (!portfolio.purposes.some((item) => item.purpose.id === state.purpose.id)) return portfolio;
  return {
    ...portfolio,
    purposes: portfolio.purposes.map((item) => item.purpose.id === state.purpose.id ? state : item),
    updatedAt: now(),
  };
}

export function selectLearningPurpose(portfolio: LearningPortfolio, purposeId: string): LearningPortfolio {
  if (!portfolio.purposes.some((state) => state.purpose.id === purposeId)) return portfolio;
  return { ...portfolio, selectedPurposeId: purposeId, updatedAt: now() };
}

export function setPurposeRecommendation(portfolio: LearningPortfolio, recommendation: PurposeRecommendation): LearningPortfolio {
  if (!portfolio.purposes.some((state) => state.purpose.id === recommendation.purposeId)) return portfolio;
  return { ...portfolio, recommendation, updatedAt: now() };
}

export function getSelectedLearningState(portfolio: LearningPortfolio): LearningState {
  return portfolio.purposes.find((state) => state.purpose.id === portfolio.selectedPurposeId) ?? portfolio.purposes[0];
}

export function resumePortfolio(serialized: string): LearningPortfolio {
  const raw: unknown = JSON.parse(serialized);
  const current = learningPortfolioSchema.safeParse(raw);
  if (current.success) return current.data;
  const legacy = learningStateSchema.safeParse(raw);
  if (legacy.success) return createPortfolio(legacy.data);
  throw new Error("Saved learning portfolio is invalid.");
}

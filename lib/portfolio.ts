import { z } from "zod";

import { learningStateSchema } from "./learning";
import type { AllocationRecord, LearningPortfolio, LearningState, PurposeRecommendation } from "./types";

export const purposeRecommendationSchema = z.object({
  purposeId: z.string(),
  reason: z.string(),
  basis: z.array(z.string()),
});

const purposeContextSchema = z.object({ deadline: z.string().nullable(), importance: z.enum(["low", "normal", "high"]), usageContext: z.string() });

export const learningPortfolioSchema = z.object({
  version: z.literal(4),
  purposes: z.array(learningStateSchema).min(1),
  selectedPurposeId: z.string(),
  recommendation: purposeRecommendationSchema.nullable(),
  recommendationHistory: z.array(purposeRecommendationSchema).default([]),
  contextChanges: z.array(z.object({ purposeId: z.string(), before: purposeContextSchema, after: purposeContextSchema, changedAt: z.string() })).default([]),
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
    version: 4,
    purposes: [initial],
    selectedPurposeId: initial.purpose.id,
    recommendation: null,
    recommendationHistory: [],
    contextChanges: [],
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
  if (!portfolio.purposes.some((state) => state.purpose.id === recommendation.purposeId && state.purpose.status === "active")) return portfolio;
  const recorded = { ...recommendation, createdAt: now() };
  return { ...portfolio, recommendation: recorded, recommendationHistory: [...portfolio.recommendationHistory, recorded], updatedAt: now() };
}

export function updatePurposeContext(portfolio: LearningPortfolio, purposeId: string, context: { deadline: string | null; importance: "low" | "normal" | "high"; usageContext: string }): LearningPortfolio {
  const state = portfolio.purposes.find((item) => item.purpose.id === purposeId);
  if (!state) return portfolio;
  const before = { deadline: state.purpose.deadline, importance: state.purpose.importance, usageContext: state.purpose.usageContext };
  return { ...portfolio, purposes: portfolio.purposes.map((item) => item.purpose.id === purposeId ? { ...item, purpose: { ...item.purpose, ...context }, updatedAt: now() } : item), contextChanges: [...portfolio.contextChanges, { purposeId, before, after: context, changedAt: now() }], updatedAt: now() };
}

export function setPurposeStatus(portfolio: LearningPortfolio, purposeId: string, status: LearningState["purpose"]["status"], reason: string): LearningPortfolio {
  const purposes = portfolio.purposes.map((state) => state.purpose.id === purposeId ? { ...state, purpose: { ...state.purpose, status, statusReason: reason, statusChangedAt: now() }, updatedAt: now() } : state);
  const active = purposes.filter((state) => state.purpose.status === "active");
  const selectedPurposeId = purposes.find((state) => state.purpose.id === portfolio.selectedPurposeId)?.purpose.status === "active" ? portfolio.selectedPurposeId : (active[0]?.purpose.id ?? portfolio.selectedPurposeId);
  return { ...portfolio, purposes, selectedPurposeId, recommendation: portfolio.recommendation?.purposeId === purposeId && status !== "active" ? null : portfolio.recommendation, updatedAt: now() };
}

export function recordAllocation(portfolio: LearningPortfolio, purposeId: string, input: Pick<AllocationRecord, "depth" | "minutes" | "note">): LearningPortfolio {
  const record: AllocationRecord = { ...input, id: crypto.randomUUID(), recordedAt: now() };
  return { ...portfolio, purposes: portfolio.purposes.map((state) => state.purpose.id === purposeId ? { ...state, allocations: [...state.allocations, record], updatedAt: now() } : state), updatedAt: now() };
}

export function reflectOnAllocation(portfolio: LearningPortfolio, purposeId: string, judgment: "intentional" | "unintended", reason: string): LearningPortfolio {
  return { ...portfolio, purposes: portfolio.purposes.map((state) => state.purpose.id === purposeId ? { ...state, allocationReflection: { judgment, reason, recordedAt: now() }, updatedAt: now() } : state), updatedAt: now() };
}

export function getSelectedLearningState(portfolio: LearningPortfolio): LearningState {
  return portfolio.purposes.find((state) => state.purpose.id === portfolio.selectedPurposeId) ?? portfolio.purposes[0];
}

export function resumePortfolio(serialized: string): LearningPortfolio {
  const raw: unknown = JSON.parse(serialized);
  const current = learningPortfolioSchema.safeParse(raw);
  if (current.success) return current.data;
  const legacyPortfolio = z.object({ version: z.literal(3), purposes: z.array(learningStateSchema).min(1), selectedPurposeId: z.string(), recommendation: purposeRecommendationSchema.nullable(), updatedAt: z.string() }).safeParse(raw);
  if (legacyPortfolio.success) return learningPortfolioSchema.parse({ ...legacyPortfolio.data, version: 4, recommendationHistory: legacyPortfolio.data.recommendation ? [legacyPortfolio.data.recommendation] : [], contextChanges: [] });
  const legacy = learningStateSchema.safeParse(raw);
  if (legacy.success) return createPortfolio(legacy.data);
  throw new Error("Saved learning portfolio is invalid.");
}

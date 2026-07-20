import { z } from "zod";

import type {
  FocusRecommendation,
  LearningGap,
  LearningPathNode,
  LearningState,
  UnderstandingCheckResult,
} from "./types";

const pathNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  dependsOn: z.array(z.string()),
  status: z.enum(["unknown", "unconfirmed", "confirmed", "gap"]),
});

const stateSchema = z.object({
  version: z.literal(2),
  purpose: z.object({
    id: z.string(),
    statement: z.string(),
    role: z.string(),
    why: z.string(),
    priority: z.literal("normal"),
    createdAt: z.string(),
  }),
  phase: z.enum(["exploring", "learning"]),
  targetState: z.string().nullable(),
  path: z.array(pathNodeSchema),
  currentNodeId: z.string().nullable(),
  focus: z.object({
    id: z.string(),
    kind: z.enum(["explore", "learn", "reinforce"]),
    title: z.string(),
    reason: z.string(),
    nodeId: z.string().nullable(),
  }).nullable(),
  lastCheck: z.object({
    nodeId: z.string(),
    outcome: z.enum(["confirmed", "gap"]),
    summary: z.string(),
    nextAction: z.string(),
    gap: z.object({
      id: z.string(), topic: z.string(), reason: z.string(), impact: z.string(), returnNodeId: z.string(),
    }).nullable(),
  }).nullable(),
  gaps: z.array(z.object({
    id: z.string(),
    topic: z.string(),
    reason: z.string(),
    impact: z.string(),
    returnNodeId: z.string(),
    status: z.enum(["recommended", "deferred", "resolved"]),
  })),
  updatedAt: z.string(),
});

function now() {
  return new Date().toISOString();
}

function firstActionableNode(path: LearningPathNode[]) {
  return path.find((node) => node.status === "unconfirmed" && node.dependsOn.every((id) => path.find((candidate) => candidate.id === id)?.status === "confirmed"))
    ?? path.find((node) => node.status === "unconfirmed")
    ?? null;
}

export function createLearningState(input: { purpose: string; role: string; why: string }): LearningState {
  const createdAt = now();
  return {
    version: 2,
    purpose: { id: crypto.randomUUID(), statement: input.purpose, role: input.role, why: input.why, priority: "normal", createdAt },
    phase: "exploring",
    targetState: null,
    path: [],
    currentNodeId: null,
    focus: null,
    lastCheck: null,
    gaps: [],
    updatedAt: createdAt,
  };
}

export function setLearningPlan(state: LearningState, targetState: string, path: LearningPathNode[]): LearningState {
  const current = firstActionableNode(path);
  return { ...state, phase: "learning", targetState, path, currentNodeId: current?.id ?? null, focus: null, updatedAt: now() };
}

export function chooseFocus(state: LearningState, focus: FocusRecommendation): LearningState {
  return { ...state, focus, updatedAt: now() };
}

export function applyCheckResult(state: LearningState, result: UnderstandingCheckResult): LearningState {
  const path = state.path.map((node) => node.id === result.nodeId ? { ...node, status: result.outcome === "confirmed" ? "confirmed" as const : "gap" as const } : node);
  if (result.outcome === "confirmed") {
    const next = firstActionableNode(path);
    return {
      ...state,
      path,
      currentNodeId: next?.id ?? result.nodeId,
      focus: next ? { id: `focus-${next.id}`, kind: "learn", title: next.title, reason: result.nextAction, nodeId: next.id } : null,
      lastCheck: result,
      updatedAt: now(),
    };
  }

  if (!result.gap) throw new Error("A gap result requires gap details.");
  const gap: LearningGap = { ...result.gap, status: "recommended" };
  return {
    ...state,
    path,
    currentNodeId: result.nodeId,
    focus: { id: `reinforce-${gap.id}`, kind: "reinforce", title: gap.topic, reason: `${gap.reason}。${gap.impact}`, nodeId: result.nodeId },
    lastCheck: result,
    gaps: [...state.gaps.filter((item) => item.id !== gap.id), gap],
    updatedAt: now(),
  };
}

export function deferGap(state: LearningState, gapId: string): LearningState {
  return {
    ...state,
    focus: state.focus?.kind === "reinforce" ? null : state.focus,
    gaps: state.gaps.map((gap) => gap.id === gapId ? { ...gap, status: "deferred" } : gap),
    updatedAt: now(),
  };
}

export function completeReinforcement(state: LearningState, gapId: string): LearningState {
  const gap = state.gaps.find((item) => item.id === gapId);
  if (!gap) return state;
  return {
    ...state,
    currentNodeId: gap.returnNodeId,
    focus: { id: `return-${gap.returnNodeId}`, kind: "learn", title: state.path.find((node) => node.id === gap.returnNodeId)?.title ?? "元の学びへ戻る", reason: "補強を終えたため元の学習経路へ戻ります", nodeId: gap.returnNodeId },
    gaps: state.gaps.map((item) => item.id === gapId ? { ...item, status: "resolved" } : item),
    updatedAt: now(),
  };
}

export function resumeLearning(serialized: string): LearningState {
  return stateSchema.parse(JSON.parse(serialized));
}

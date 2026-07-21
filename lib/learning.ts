import { z } from "zod";

import type {
  FocusRecommendation,
  FocusExplanation,
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

export const learningDataPolicy = {
  recorded: "学習目的、到達状態、学習経路、確認結果、抜け、配分記録、訂正履歴",
  use: "個別の推奨と理解確認。設定時は学習状態と教材をOpenAI APIへ送信",
  sharing: "他の学習者へは共有しない。API提供者による処理範囲を除き外部共有しない",
} as const;

export const learningStateSchema = z.object({
  version: z.literal(2),
  purpose: z.object({
    id: z.string(),
    statement: z.string(),
    role: z.string(),
    why: z.string(),
    priority: z.literal("normal"),
    deadline: z.string().nullable().default(null),
    importance: z.enum(["low", "normal", "high"]).default("normal"),
    usageContext: z.string().default(""),
    status: z.enum(["active", "paused", "achieved", "stopped"]).default("active"),
    statusReason: z.string().default(""),
    statusChangedAt: z.string().default(""),
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
    source: z.enum(["personalized", "demo", "learner", "inferred"]).optional(),
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
  checkHistory: z.array(z.object({
    nodeId: z.string(), outcome: z.enum(["confirmed", "gap"]), summary: z.string(), nextAction: z.string(),
    gap: z.object({ id: z.string(), topic: z.string(), reason: z.string(), impact: z.string(), returnNodeId: z.string() }).nullable(),
  })).default([]),
  positionCorrections: z.array(z.object({
    id: z.string(), kind: z.enum(["position", "dependency"]).default("position"), previousNodeId: z.string().nullable(), nodeId: z.string(),
    previousDependsOn: z.array(z.string()).default([]), nextDependsOn: z.array(z.string()).default([]), reason: z.string(), createdAt: z.string(),
  })).default([]),
  checkChallenges: z.array(z.object({
    id: z.string(), checkIndex: z.number().int().nonnegative(), nodeId: z.string(), reason: z.string(),
    status: z.enum(["pending", "reviewed"]), resolutionCheckIndex: z.number().int().nonnegative().nullable(), createdAt: z.string(),
  })).default([]),
  gaps: z.array(z.object({
    id: z.string(),
    topic: z.string(),
    reason: z.string(),
    impact: z.string(),
    returnNodeId: z.string(),
    status: z.enum(["recommended", "deferred", "resolved"]),
  })),
  allocations: z.array(z.object({
    id: z.string(), depth: z.enum(["ear", "desk", "deep"]), minutes: z.number().int().positive(), note: z.string(), recordedAt: z.string(),
  })).default([]),
  allocationReflection: z.object({ judgment: z.enum(["intentional", "unintended"]), reason: z.string(), recordedAt: z.string() }).nullable().default(null),
  updatedAt: z.string(),
});

function now() {
  return new Date().toISOString();
}

function firstActionableNode(path: LearningPathNode[]) {
  return path.find((node) => node.status === "unconfirmed" && node.dependsOn.every((id) => path.find((candidate) => candidate.id === id)?.status === "confirmed"))
    ?? path.find((node) => node.status === "unconfirmed")
    ?? path.find((node) => node.status === "unknown")
    ?? null;
}

function hasDependencyCycle(path: LearningPathNode[]) {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const node = path.find((candidate) => candidate.id === id);
    if (node?.dependsOn.some(visit)) return true;
    visiting.delete(id); visited.add(id); return false;
  };
  return path.some((node) => visit(node.id));
}

export function createLearningState(input: { purpose: string; role: string; why: string }): LearningState {
  const createdAt = now();
  return {
    version: 2,
    purpose: { id: crypto.randomUUID(), statement: input.purpose, role: input.role, why: input.why, priority: "normal", deadline: null, importance: "normal", usageContext: "", status: "active", statusReason: "", statusChangedAt: createdAt, createdAt },
    phase: "exploring",
    targetState: null,
    path: [],
    currentNodeId: null,
    focus: null,
    lastCheck: null,
    checkHistory: [],
    positionCorrections: [],
    checkChallenges: [],
    gaps: [],
    allocations: [],
    allocationReflection: null,
    updatedAt: createdAt,
  };
}

export function setLearningPlan(state: LearningState, targetState: string, path: LearningPathNode[]): LearningState {
  const protectedPath = path.map((node) => {
    const existing = state.path.find((candidate) => candidate.id === node.id);
    return { ...node, status: existing?.status ?? (node.status === "unknown" ? "unknown" as const : "unconfirmed" as const) };
  });
  const current = firstActionableNode(protectedPath);
  return { ...state, phase: "learning", targetState, path: protectedPath, currentNodeId: current?.id ?? null, focus: null, updatedAt: now() };
}

export function chooseFocus(state: LearningState, focus: FocusRecommendation): LearningState {
  return { ...state, focus, updatedAt: now() };
}

export function explainFocus(state: LearningState): FocusExplanation {
  const current = state.path.find((node) => node.id === state.currentNodeId);
  const lastCheck = state.lastCheck;
  const uncertainty: string[] = [];
  if (!state.targetState) uncertainty.push("到達状態はまだ決まっていません");
  if (!current) uncertainty.push("現在地を判断できる学習経路がまだありません");
  if (!lastCheck) uncertainty.push("理解状態を裏づける理解確認がまだありません");

  return {
    basis: [
      { label: "学習目的", value: state.purpose.statement, certainty: "learner_input" },
      { label: "到達状態", value: state.targetState ?? "未設定", certainty: state.targetState ? "learner_input" : "unknown" },
      { label: "現在地", value: current?.title ?? "判断できない", certainty: current ? (current.status === "confirmed" ? "confirmed" : "inferred") : "unknown" },
      { label: "理解状態", value: lastCheck?.summary ?? "まだ理解確認がない", certainty: lastCheck ? "confirmed" : "unknown" },
    ],
    uncertainty,
  };
}

export function recordPositionCorrection(state: LearningState, input: { nodeId: string; reason: string }): LearningState {
  const node = state.path.find((candidate) => candidate.id === input.nodeId);
  if (!node || !input.reason.trim()) return state;
  const correction = {
    id: crypto.randomUUID(),
    kind: "position" as const,
    previousNodeId: state.currentNodeId,
    nodeId: node.id,
    previousDependsOn: node.dependsOn,
    nextDependsOn: node.dependsOn,
    reason: input.reason.trim(),
    createdAt: now(),
  };
  return {
    ...state,
    currentNodeId: node.id,
    focus: { id: `learner-${node.id}`, kind: "learn", title: node.title, reason: `学習者の訂正: ${correction.reason}`, nodeId: node.id, source: "learner" },
    positionCorrections: [...state.positionCorrections, correction],
    updatedAt: correction.createdAt,
  };
}

export function recordDependencyCorrection(state: LearningState, input: { nodeId: string; dependsOn: string[]; reason: string }): LearningState {
  const node = state.path.find((candidate) => candidate.id === input.nodeId);
  const nextDependsOn = [...new Set(input.dependsOn)].filter((id) => id !== input.nodeId && state.path.some((candidate) => candidate.id === id));
  if (!node || !input.reason.trim()) return state;
  const path = state.path.map((candidate) => candidate.id === node.id ? { ...candidate, dependsOn: nextDependsOn } : candidate);
  if (hasDependencyCycle(path)) return state;
  const next = firstActionableNode(path);
  const correction = {
    id: crypto.randomUUID(), kind: "dependency" as const, previousNodeId: state.currentNodeId, nodeId: node.id,
    previousDependsOn: node.dependsOn, nextDependsOn, reason: input.reason.trim(), createdAt: now(),
  };
  return {
    ...state,
    path,
    currentNodeId: next?.id ?? state.currentNodeId,
    focus: next ? { id: `inferred-${next.id}`, kind: "learn", title: next.title, reason: `前提関係の訂正を反映: ${correction.reason}`, nodeId: next.id, source: "inferred" } : state.focus,
    positionCorrections: [...state.positionCorrections, correction],
    updatedAt: correction.createdAt,
  };
}

export function challengeUnderstanding(state: LearningState, reason: string): LearningState {
  if (!state.lastCheck || !reason.trim()) return state;
  const challenge = {
    id: crypto.randomUUID(),
    checkIndex: Math.max(0, state.checkHistory.length - 1),
    nodeId: state.lastCheck.nodeId,
    reason: reason.trim(),
    status: "pending" as const,
    resolutionCheckIndex: null,
    createdAt: now(),
  };
  return { ...state, checkChallenges: [...state.checkChallenges, challenge], updatedAt: challenge.createdAt };
}

export function applyCheckResult(state: LearningState, result: UnderstandingCheckResult): LearningState {
  const path = state.path.map((node) => node.id === result.nodeId ? { ...node, status: result.outcome === "confirmed" ? "confirmed" as const : "gap" as const } : node);
  const resolutionCheckIndex = state.checkHistory.length;
  const resolvesChallenge = state.checkChallenges.some((challenge) => challenge.status === "pending" && challenge.nodeId === result.nodeId);
  const checkChallenges = state.checkChallenges.map((challenge) =>
    challenge.status === "pending" && challenge.nodeId === result.nodeId
      ? { ...challenge, status: "reviewed" as const, resolutionCheckIndex }
      : challenge,
  );
  if (result.outcome === "confirmed") {
    const next = firstActionableNode(path);
    return {
      ...state,
      path,
      currentNodeId: next?.id ?? result.nodeId,
      focus: next ? { id: `focus-${next.id}`, kind: "learn", title: next.title, reason: result.nextAction, nodeId: next.id, source: "inferred" } : null,
      lastCheck: result,
      checkHistory: [...state.checkHistory, result],
      checkChallenges,
      gaps: resolvesChallenge ? state.gaps.map((gap) => gap.returnNodeId === result.nodeId ? { ...gap, status: "resolved" as const } : gap) : state.gaps,
      updatedAt: now(),
    };
  }

  if (!result.gap) throw new Error("A gap result requires gap details.");
  const gap: LearningGap = { ...result.gap, status: "recommended" };
  return {
    ...state,
    path,
    currentNodeId: result.nodeId,
    focus: { id: `reinforce-${gap.id}`, kind: "reinforce", title: gap.topic, reason: `${gap.reason}。${gap.impact}`, nodeId: result.nodeId, source: "inferred" },
    lastCheck: result,
    checkHistory: [...state.checkHistory, result],
    checkChallenges,
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
    focus: { id: `return-${gap.returnNodeId}`, kind: "learn", title: state.path.find((node) => node.id === gap.returnNodeId)?.title ?? "元の学びへ戻る", reason: "補強を終えたため元の学習経路へ戻ります", nodeId: gap.returnNodeId, source: "inferred" },
    gaps: state.gaps.map((item) => item.id === gapId ? { ...item, status: "resolved" } : item),
    updatedAt: now(),
  };
}

export function resumeLearning(serialized: string): LearningState {
  return learningStateSchema.parse(JSON.parse(serialized));
}

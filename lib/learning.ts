import { z } from "zod";

import type {
  FocusRecommendation,
  FocusExplanation,
  LearningGap,
  LearningPathNode,
  LearningState,
  NextMove,
  GapRelation,
  UnderstandingCheckResult,
  TargetAssessment,
  AllocationProgressReview,
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
  rhythm: z.object({ lightMinutes: z.number().int().nonnegative(), deepMinutes: z.number().int().nonnegative(), note: z.string(), updatedAt: z.string() }).nullable().default(null),
  targetRevisions: z.array(z.object({ previous: z.string().nullable(), next: z.string(), relatedNodeIds: z.array(z.string()), reviewNodeIds: z.array(z.string()), createdAt: z.string() })).default([]),
  focusDecisions: z.array(z.object({ previousFocus: z.object({ id: z.string(), kind: z.enum(["explore", "learn", "reinforce"]), title: z.string(), reason: z.string(), nodeId: z.string().nullable(), source: z.enum(["personalized", "demo", "learner", "inferred"]).optional() }), reason: z.string(), action: z.enum(["defer", "change"]), createdAt: z.string() })).default([]),
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

export function deriveNextMove(state: LearningState, result: UnderstandingCheckResult): NextMove {
  if (result.outcome === "gap" && result.gap) {
    return {
      kind: "retry",
      title: `${result.gap.topic}だけを別の方法で確かめる`,
      reason: `${result.summary}という確認結果から、${result.gap.reason}に絞ります。${result.nextAction}`,
      scope: result.gap.topic,
      preserved: result.summary,
    };
  }
  const checkedPath = state.path.map((node) => node.id === result.nodeId ? { ...node, status: "confirmed" as const } : node);
  const next = firstActionableNode(checkedPath);
  return next
    ? { kind: "advance", title: next.title, reason: `${result.summary}と確認できたため、学習経路の次へ進みます。`, scope: next.title, preserved: result.summary }
    : { kind: "complete", title: "到達状態を振り返る", reason: `${result.summary}と確認でき、現在の学習経路を終えました。`, scope: state.targetState ?? state.purpose.statement, preserved: result.summary };
}

function downstreamCount(path: LearningPathNode[], nodeId: string): number {
  const direct = path.filter((node) => node.dependsOn.includes(nodeId));
  return direct.length + direct.reduce((sum, node) => sum + downstreamCount(path, node.id), 0);
}

export function prioritizeOpenGaps(state: LearningState) {
  const open = state.gaps.filter((gap) => gap.status !== "resolved");
  if (!open.length) return null;
  const ranked = open.map((gap, index) => {
    const returnNode = state.path.find((node) => node.id === gap.returnNodeId);
    const dependency = returnNode?.dependsOn.find((id) => state.path.some((node) => node.id === id && gap.topic.includes(node.title.replace(/を.*$/, ""))));
    return { gap, index, score: returnNode ? downstreamCount(state.path, returnNode.id) + (dependency ? 2 : 0) : -1 };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  return { gap: ranked[0].gap, reason: `${ranked[0].gap.impact}ため、現在の到達状態への影響が最も大きい一件です。`, remaining: ranked.slice(1).map((item) => item.gap) };
}

export function explainGapRelation(state: LearningState, gap: LearningGap): GapRelation {
  const returnNode = state.path.find((node) => node.id === gap.returnNodeId);
  if (!returnNode) return { kind: "unknown", explanation: `「${gap.topic}」と到達状態の関係は、現在の学習経路からは確認できません。`, timing: "補強するか、いつ取り組むかはあなたが決められます。" };
  return {
    kind: "required",
    explanation: `「${gap.topic}」は、現在地の「${returnNode.title}」へ戻るために必要です。ここを補うことで「${state.targetState ?? state.purpose.statement}」への経路を続けられます。`,
    timing: "今補強するか、あとで取り組むかはあなたが決められます。",
  };
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
    rhythm: null,
    targetRevisions: [],
    focusDecisions: [],
    updatedAt: createdAt,
  };
}

export function summarizeRemaining(state: LearningState) {
  return {
    confirmed: state.path.filter((node) => node.status === "confirmed"),
    gaps: state.path.filter((node) => node.status === "gap"),
    unconfirmed: state.path.filter((node) => node.status === "unconfirmed" || node.status === "unknown"),
    note: "未確認は、できないと判明した抜けではありません。順序は状況に応じて見直せます。",
  };
}

export function assessTargetAchievement(state: LearningState): TargetAssessment {
  if (!state.targetState) return { status: "no_target", basis: [], remaining: [], reason: "到達状態が未設定のため、探索を続けます。", finalDecisionOwner: "learner" };
  const confirmed = state.path.filter((node) => node.status === "confirmed");
  const remaining = state.path.filter((node) => node.status !== "confirmed");
  if (!remaining.length && state.path.length > 0) {
    return { status: "ready_for_decision", basis: confirmed.map((node) => node.title), remaining: [], reason: "到達状態に必要な項目を確認できました。達成とするかはあなたが決めます。", finalDecisionOwner: "learner" };
  }
  return {
    status: "checks_remaining",
    basis: confirmed.map((node) => node.title),
    remaining: remaining.map((node) => node.title),
    reason: "使った時間や教材量ではなく、残る理解確認があるため到達済みとは判断しません。",
    finalDecisionOwner: "learner",
  };
}

export function reviewAllocationProgress(state: LearningState): AllocationProgressReview {
  const byDepth = state.allocations.reduce((total, record) => ({ ...total, [record.depth]: total[record.depth] + record.minutes }), { ear: 0, desk: 0, deep: 0 });
  const confirmedCount = state.path.filter((node) => node.status === "confirmed").length;
  const gapCount = state.path.filter((node) => node.status === "gap").length;
  const nextAllocationReason = state.allocationReflection?.judgment === "unintended"
    ? `意図しない偏り「${state.allocationReflection.reason}」を避け、未確認または抜けへ次の集中資源を配ります。`
    : "現在の配分意図を保ち、次の確認結果を見て判断します。";
  return {
    investedMinutes: state.allocations.reduce((sum, record) => sum + record.minutes, 0),
    byDepth,
    confirmedCount,
    gapCount,
    judgment: confirmedCount > 0 ? `確認できた項目が${confirmedCount}件増えました` : "投入量だけでは接近を判断できない",
    nextAllocationReason,
  };
}

export function updateLearningRhythm(state: LearningState, input: { lightMinutes: number; deepMinutes: number; note: string }): LearningState {
  return { ...state, rhythm: { ...input, updatedAt: now() }, updatedAt: now() };
}

export function reconsiderTarget(state: LearningState, next: string, relatedNodeIds: string[]): LearningState {
  if (!next.trim()) return state;
  const related = state.path.filter((node) => relatedNodeIds.includes(node.id)).map((node) => node.id);
  const revision = { previous: state.targetState, next: next.trim(), relatedNodeIds: related, reviewNodeIds: state.path.filter((node) => !related.includes(node.id)).map((node) => node.id), createdAt: now() };
  return { ...state, targetState: revision.next, targetRevisions: [...state.targetRevisions, revision], updatedAt: revision.createdAt };
}

export function rejectFocus(state: LearningState, reason: string, action: "defer" | "change"): LearningState {
  if (!state.focus || !reason.trim()) return state;
  const previousFocus = state.focus;
  const alternative = state.path.find((node) => node.id !== previousFocus.nodeId && node.status !== "confirmed");
  return { ...state, focus: action === "change" && alternative ? { id: `alternative-${alternative.id}`, kind: "learn", title: alternative.title, reason: `「${reason.trim()}」を反映した代替です。`, nodeId: alternative.id, source: "inferred" } : null, focusDecisions: [...state.focusDecisions, { previousFocus, reason: reason.trim(), action, createdAt: now() }], updatedAt: now() };
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
  const nextMove = deriveNextMove(state, result);
  if (result.outcome === "confirmed") {
    const next = firstActionableNode(path);
    return {
      ...state,
      path,
      currentNodeId: next?.id ?? result.nodeId,
      focus: next ? { id: `focus-${next.id}`, kind: "learn", title: nextMove.title, reason: nextMove.reason, nodeId: next.id, source: "inferred" } : null,
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
    focus: { id: `reinforce-${gap.id}`, kind: "reinforce", title: nextMove.title, reason: nextMove.reason, nodeId: result.nodeId, source: "inferred" },
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

import { z } from "zod";

import type { LearningPlanProposal, LearningState, UnderstandingCheckResult } from "./types";

export const learningPlanSchema = z.object({
  mode: z.enum(["exploring", "learning"]),
  targetState: z.string().nullable(),
  path: z.array(z.object({
    id: z.string(),
    title: z.string(),
    dependsOn: z.array(z.string()),
    status: z.enum(["unknown", "unconfirmed", "confirmed", "gap"]),
  })),
  currentNodeId: z.string().nullable(),
  focus: z.object({
    id: z.string(),
    kind: z.enum(["explore", "learn", "reinforce"]),
    title: z.string(),
    reason: z.string(),
    nodeId: z.string().nullable(),
  }),
  check: z.object({ nodeId: z.string().nullable(), prompt: z.string(), reason: z.string() }),
});

export const understandingCheckSchema = z.object({
  nodeId: z.string(),
  outcome: z.enum(["confirmed", "gap"]),
  summary: z.string(),
  nextAction: z.string(),
  gap: z.object({
    id: z.string(),
    topic: z.string(),
    reason: z.string(),
    impact: z.string(),
    returnNodeId: z.string(),
  }).nullable(),
});

export function buildLearningPlanPrompt({ state, material = "" }: { state: LearningState; material?: string }) {
  const target = state.targetState ?? "未設定";
  const path = state.path.length ? state.path.map((node) => `- ${node.id}: ${node.title} / dependsOn=${node.dependsOn.join(",") || "なし"} / ${node.status}`).join("\n") : "なし";
  const gaps = state.gaps.length ? state.gaps.map((gap) => `- ${gap.id}: ${gap.topic} / ${gap.reason} / impact=${gap.impact} / ${gap.status}`).join("\n") : "なし";
  return `あなたはShiboriの学習配分担当です。学習者が次に集中する一つだけを決めます。

## 学習者
- 活動: ${state.purpose.role || "未入力"}
- 学習目的: ${state.purpose.statement}
- 学ぶ理由: ${state.purpose.why || "知りたいという欲求"}
- 到達状態: ${target}

## 現在の学習経路
${path}

## 抜け
${gaps}

## 任意の教材
${material.trim() || "なし"}

## 判断規則
- 到達状態が未設定なら、到達状態を強制しない。興味を具体化する探索を一つだけ推奨する。
- 到達状態を返す場合は、Willではなく「〜できる」というCanで表す。
- 学習経路は一本道と決めつけず、依存関係が不明ならstatusをunknownにする。
- 集中先は一つだけ返し、理由を学習目的、到達状態、理解状態へ結びつける。
- deferredの抜けは消さず、補強を命令しない。他の学びも選べる。
- 教材へ触れたことだけでstatusをconfirmedにしない。
- checkは説明、計算、判断、実行のいずれかで、現在の集中先だけを確かめる。`;
}

export function buildCheckPrompt({ state, prompt, answer }: { state: LearningState; prompt: string; answer: string }) {
  return `あなたはShiboriの理解確認担当です。学習者の回答から、確認した部分だけの理解状態を判断します。

## 学習目的
${state.purpose.statement}

## 到達状態
${state.targetState ?? "探索中"}

## 現在地
${state.currentNodeId ?? "探索中"}

## 理解確認
${prompt}

## 回答
${answer}

## 判断規則
- 読んだ・聞いたことを理解確認にしない。回答で説明、計算、判断、実行できたかを見る。
- 一部だけ不足する場合、できなかった部分だけをgapにする。単元全体を否定しない。
- confirmedならgapはnull。gapなら現在地へ戻るために必要な一件だけを返す。
- nextActionは次の一手を一つだけ返す。`;
}

export function createDemoLearningPlan(state: LearningState): LearningPlanProposal {
  if (!state.targetState) {
    return {
      mode: "exploring",
      targetState: null,
      path: [],
      currentNodeId: null,
      focus: {
        id: "explore-first",
        kind: "explore",
        title: `「${state.purpose.statement}」の全体像を一つの具体例でつかむ`,
        reason: "何に一番惹かれるかを見つけ、次のCanを考える材料にするためです。",
        nodeId: null,
      },
      check: {
        nodeId: null,
        prompt: "いちばん面白いと感じた点と、次に自分で説明できるようになりたいことを書いてください。",
        reason: "探索経験から次の到達状態を見つけるためです。",
      },
    };
  }

  const path = state.path.length ? state.path : [{ id: "target", title: state.targetState, dependsOn: [], status: "unconfirmed" as const }];
  const current = path.find((node) => node.id === state.currentNodeId) ?? path.find((node) => node.status === "unconfirmed");
  return {
    mode: "learning",
    targetState: state.targetState,
    path,
    currentNodeId: current?.id ?? null,
    focus: state.focus ?? {
      id: `learn-${current?.id ?? "next"}`,
      kind: "learn",
      title: current?.title ?? state.targetState,
      reason: "現在の理解状態から到達状態へ近づく次の一つです。",
      nodeId: current?.id ?? null,
    },
    check: {
      nodeId: current?.id ?? null,
      prompt: `${current?.title ?? state.targetState}ことを、自分の言葉や具体例で示してください。`,
      reason: "教材へ触れたことと、できるようになったことを区別するためです。",
    },
  };
}

export function createDemoCheckResult(state: LearningState, answer: string): UnderstandingCheckResult {
  const nodeId = state.currentNodeId ?? state.focus?.nodeId ?? "exploration";
  const confirmed = answer.trim().length >= 40;
  return confirmed ? {
    nodeId,
    outcome: "confirmed",
    summary: "自分の言葉で具体的に説明できています。",
    nextAction: "次の現在地へ進む",
    gap: null,
  } : {
    nodeId,
    outcome: "gap",
    summary: "考えたことは見えますが、具体例または理由がまだ不足しています。",
    nextAction: "具体例を一つ加えて説明し直す",
    gap: {
      id: crypto.randomUUID(),
      topic: state.focus?.title ?? "現在の集中先",
      reason: "説明を支える具体例が不足しています",
      impact: `「${state.targetState ?? state.purpose.statement}」を自分の言葉で示す土台になります`,
      returnNodeId: nodeId,
    },
  };
}

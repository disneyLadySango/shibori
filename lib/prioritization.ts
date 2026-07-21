import { z } from "zod";

import type { LearningPortfolio, PurposeRecommendation } from "./types";

export const purposeRecommendationOutputSchema = z.object({
  purposeId: z.string(),
  reason: z.string(),
  basis: z.array(z.string()),
});

export function buildPurposeRecommendationPrompt(portfolio: LearningPortfolio, availableFocus: string) {
  const purposes = portfolio.purposes.map((state, index) => {
    const current = state.path.find((node) => node.id === state.currentNodeId)?.title ?? "探索中";
    const confirmed = state.path.filter((node) => node.status === "confirmed").map((node) => node.title);
    const gaps = state.gaps.filter((gap) => gap.status !== "resolved").map((gap) => `${gap.topic} (${gap.status})`);
    return `### ${index + 1}. ${state.purpose.statement}
- ID: ${state.purpose.id}
- 学ぶ理由: ${state.purpose.why || "知りたいという欲求"}
- 到達状態: ${state.targetState ?? "未設定、探索中"}
- 現在地: ${current}
- 確認できたこと: ${confirmed.join(" / ") || "なし"}
- 抜け: ${gaps.join(" / ") || "なし"}`;
  }).join("\n\n");

  return `あなたはShiboriの学習ポートフォリオ配分担当です。複数の学習目的から、次に集中するおすすめを一つだけ返します。

## 学習ポートフォリオ
${purposes}

## 今使える集中資源
${availableFocus.trim() || "未入力"}

## 判断規則
- purposeIdは上記IDから一つだけ選ぶ。
- 理由は学習目的、到達状態、理解状態、今使える集中資源のうち、実際に判断へ使った事実へ結びつける。
- 期限や実用性がないことだけを理由に低く扱わない。知りたい、面白いという欲求は同等に有効である。
- おすすめは命令ではない。最終的に選ぶのは学習者であり、別の学習目的も選べる。
- basisには理由で使った事実の種類を短く列挙する。候補一覧や第二候補は返さない。`;
}

export function createDemoPurposeRecommendation(portfolio: LearningPortfolio): PurposeRecommendation {
  const selected = portfolio.purposes.find((state) => state.purpose.id === portfolio.selectedPurposeId) ?? portfolio.purposes[0];
  return {
    purposeId: selected.purpose.id,
    reason: `前回選んだ「${selected.purpose.statement}」の現在地が保たれているため、まずここから続けるのがおすすめです。別の学習目的を選んでも構いません。`,
    basis: ["学習者が前回選んだ目的", "現在地"],
  };
}

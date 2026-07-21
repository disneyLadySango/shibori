import { z } from "zod";

import type { LearningPortfolio, PurposeRecommendation } from "./types";

export const purposeRecommendationOutputSchema = z.object({
  purposeId: z.string(),
  reason: z.string(),
  basis: z.array(z.string()),
});

export function buildPurposeRecommendationPrompt(portfolio: LearningPortfolio, availableFocus: string) {
  const latestChange = portfolio.contextChanges.at(-1);
  const purposes = portfolio.purposes.filter((state) => state.purpose.status === "active").map((state, index) => {
    const current = state.path.find((node) => node.id === state.currentNodeId)?.title ?? "探索中";
    const confirmed = state.path.filter((node) => node.status === "confirmed").map((node) => node.title);
    const gaps = state.gaps.filter((gap) => gap.status !== "resolved").map((gap) => `${gap.topic} (${gap.status})`);
    return `### ${index + 1}. ${state.purpose.statement}
- ID: ${state.purpose.id}
- 学ぶ理由: ${state.purpose.why || "知りたいという欲求"}
- 期限: ${state.purpose.deadline || "未設定"}
- 重要度: ${{ low: "低い", normal: "通常", high: "高い" }[state.purpose.importance]}
- 利用場面: ${state.purpose.usageContext || "未設定"}
- 到達状態: ${state.targetState ?? "未設定、探索中"}
- 現在地: ${current}
- 確認できたこと: ${confirmed.join(" / ") || "なし"}
- 抜け: ${gaps.join(" / ") || "なし"}
- 配分の振り返り: ${state.allocationReflection?.judgment === "unintended" ? `意図しない偏り (${state.allocationReflection.reason})` : state.allocationReflection?.judgment === "intentional" ? "意図した偏り（修正対象にしない）" : "未記録"}`;
  }).join("\n\n");

  return `あなたはShiboriの学習ポートフォリオ配分担当です。複数の学習目的から、次に集中するおすすめを一つだけ返します。

## 学習ポートフォリオ
${purposes}

## 今使える集中資源
${availableFocus.trim() || "未入力"}

## 直近の状況変化
${latestChange ? `目的ID: ${latestChange.purposeId}\n変更前: ${JSON.stringify(latestChange.before)}\n変更後: ${JSON.stringify(latestChange.after)}` : "なし"}

## 判断規則
- purposeIdは上記IDから一つだけ選ぶ。
- 理由は学習目的、到達状態、理解状態、今使える集中資源のうち、実際に判断へ使った事実へ結びつける。
- 期限、重要度、利用場面は現在の値だけを使う。
- 直近の状況変化がある場合、変更前後のどの差を判断に使ったか理由またはbasisで明示する。
- 学習者が意図しないと記録した配分の偏りは理由に使える。意図した偏りは修正理由にしない。
- 期限や実用性がないことだけを理由に低く扱わない。知りたい、面白いという欲求は同等に有効である。
- おすすめは命令ではない。最終的に選ぶのは学習者であり、別の学習目的も選べる。
- basisには理由で使った事実の種類を短く列挙する。候補一覧や第二候補は返さない。`;
}

export function createDemoPurposeRecommendation(portfolio: LearningPortfolio): PurposeRecommendation {
  const active = portfolio.purposes.filter((state) => state.purpose.status === "active");
  const selected = [...active].sort((left, right) => {
    const importance = { low: 0, normal: 1, high: 2 };
    const importanceDifference = importance[right.purpose.importance] - importance[left.purpose.importance];
    if (importanceDifference) return importanceDifference;
    if (left.purpose.deadline && right.purpose.deadline) return left.purpose.deadline.localeCompare(right.purpose.deadline);
    if (left.purpose.deadline) return -1;
    if (right.purpose.deadline) return 1;
    return left.purpose.id === portfolio.selectedPurposeId ? -1 : 1;
  })[0];
  if (!selected) throw new Error("No active learning purpose is available.");
  const basis = [selected.purpose.deadline ? "期限" : "現在地", selected.purpose.usageContext ? "利用場面" : "学習者が前回選んだ目的"];
  if (selected.allocationReflection?.judgment === "unintended") basis.push("意図しない配分の偏り");
  return {
    purposeId: selected.purpose.id,
    reason: selected.purpose.deadline || selected.purpose.usageContext
      ? `「${selected.purpose.statement}」は${selected.purpose.deadline ? `${selected.purpose.deadline}の期限` : "期限未設定"}${selected.purpose.usageContext ? `と「${selected.purpose.usageContext}」の利用場面` : ""}が現在の状況にあるため、おすすめします。別の学習目的を選んでも構いません。`
      : `前回選んだ「${selected.purpose.statement}」の現在地が保たれているため、まずここから続けるのがおすすめです。別の学習目的を選んでも構いません。`,
    basis,
  };
}

import { describe, expect, it } from "vitest";

import { applyCheckResult, chooseFocus, createLearningState, setLearningPlan } from "./learning";
import {
  addLearningPurpose,
  createPortfolio,
  getSelectedLearningState,
  resumePortfolio,
  selectLearningPurpose,
  setPurposeRecommendation,
  updateLearningPurpose,
} from "./portfolio";

function planned(purpose: string, target: string) {
  return chooseFocus(setLearningPlan(createLearningState({ purpose, role: "", why: "" }), target, [
    { id: `${purpose}-first`, title: `${target}ための最初`, dependsOn: [], status: "unconfirmed" },
  ]), { id: `${purpose}-focus`, kind: "learn", title: `${purpose}の集中先`, reason: "現在地", nodeId: `${purpose}-first` });
}

describe("US-010 separated learning purposes", () => {
  it("updates the checked purpose without changing the other purpose", () => {
    const statistics = planned("統計", "A/Bテストを判断できる");
    const english = planned("英語", "技術発表を英語で説明できる");
    const portfolio = addLearningPurpose(createPortfolio(statistics), english);
    const checked = applyCheckResult(statistics, {
      nodeId: "統計-first", outcome: "gap", summary: "例が不足", nextAction: "例を補う",
      gap: { id: "statistics-gap", topic: "具体例", reason: "説明に必要", impact: "判断根拠が弱い", returnNodeId: "統計-first" },
    });
    const updated = updateLearningPurpose(portfolio, checked);

    expect(updated.purposes.find((item) => item.purpose.id === statistics.purpose.id)?.gaps).toHaveLength(1);
    expect(updated.purposes.find((item) => item.purpose.id === english.purpose.id)).toEqual(english);
  });

  it("returns to the exact saved state after switching purposes", () => {
    const statistics = planned("統計", "A/Bテストを判断できる");
    const english = planned("英語", "技術発表を英語で説明できる");
    const portfolio = addLearningPurpose(createPortfolio(statistics), english);
    const switched = selectLearningPurpose(portfolio, english.purpose.id);
    const returned = selectLearningPurpose(switched, statistics.purpose.id);

    expect(getSelectedLearningState(returned)).toEqual(statistics);
  });

  it("migrates the existing single-purpose state without losing its current position", () => {
    const statistics = planned("統計", "A/Bテストを判断できる");
    const migrated = resumePortfolio(JSON.stringify(statistics));
    expect(migrated.purposes).toEqual([statistics]);
    expect(migrated.selectedPurposeId).toBe(statistics.purpose.id);
  });
});

describe("US-011 learner-owned purpose choice", () => {
  it("stores at most one reasoned recommendation without changing the learner selection", () => {
    const statistics = planned("統計", "A/Bテストを判断できる");
    const english = planned("英語", "技術発表を英語で説明できる");
    const portfolio = addLearningPurpose(createPortfolio(statistics), english);
    const recommended = setPurposeRecommendation(portfolio, {
      purposeId: english.purpose.id,
      reason: "明日の発表で使い、現在地が未確認だからです。",
      basis: ["到達状態", "理解状態"],
    });

    expect(recommended.recommendation?.purposeId).toBe(english.purpose.id);
    expect(recommended.selectedPurposeId).toBe(statistics.purpose.id);
  });

  it("lets the learner choose a non-recommended curiosity without changing other states", () => {
    const practical = planned("資格試験", "問題を解ける");
    const curiosity = createLearningState({ purpose: "量子力学が面白そう", role: "", why: "知りたい" });
    const portfolio = setPurposeRecommendation(addLearningPurpose(createPortfolio(practical), curiosity), {
      purposeId: practical.purpose.id, reason: "試験が近いためです。", basis: ["利用場面"],
    });
    const selected = selectLearningPurpose(portfolio, curiosity.purpose.id);

    expect(getSelectedLearningState(selected)).toEqual(curiosity);
    expect(selected.purposes.find((item) => item.purpose.id === practical.purpose.id)).toEqual(practical);
    expect(selected.recommendation?.purposeId).toBe(practical.purpose.id);
  });
});

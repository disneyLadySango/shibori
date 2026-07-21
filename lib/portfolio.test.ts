import { describe, expect, it } from "vitest";

import { applyCheckResult, chooseFocus, createLearningState, setLearningPlan } from "./learning";
import {
  addLearningPurpose,
  createPortfolio,
  getSelectedLearningState,
  resumePortfolio,
  selectLearningPurpose,
  setPurposeRecommendation,
  setPurposeStatus,
  updatePurposeContext,
  recordAllocation,
  reflectOnAllocation,
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

  it("migrates the existing portfolio and preserves every purpose", () => {
    const statistics = planned("統計", "判断できる");
    const english = planned("英語", "説明できる");
    const current = addLearningPurpose(createPortfolio(statistics), english);
    const legacy = { ...current, version: 3, recommendationHistory: undefined, contextChanges: undefined };
    const migrated = resumePortfolio(JSON.stringify(legacy));

    expect(migrated.version).toBe(4);
    expect(migrated.purposes).toHaveLength(2);
    expect(migrated.purposes[0].path).toEqual(statistics.path);
  });
});

describe("US-012 context-aware reprioritization", () => {
  it("keeps the selected purpose and learning state while recording recommendation history", () => {
    const statistics = planned("統計", "A/Bテストを判断できる");
    const english = planned("英語", "技術発表を英語で説明できる");
    let portfolio = addLearningPurpose(createPortfolio(statistics), english);
    portfolio = setPurposeRecommendation(portfolio, { purposeId: statistics.purpose.id, reason: "現在地", basis: ["現在地"] });
    const before = portfolio.purposes[0];
    portfolio = updatePurposeContext(portfolio, english.purpose.id, { deadline: "2026-08-01", importance: "high", usageContext: "発表" });
    portfolio = setPurposeRecommendation(portfolio, { purposeId: english.purpose.id, reason: "発表期限", basis: ["期限", "利用場面"] });

    expect(portfolio.selectedPurposeId).toBe(statistics.purpose.id);
    expect(portfolio.recommendationHistory.map((item) => item.purposeId)).toEqual([statistics.purpose.id, english.purpose.id]);
    expect(portfolio.contextChanges[0]).toMatchObject({ purposeId: english.purpose.id, before: { deadline: null }, after: { deadline: "2026-08-01" } });
    expect(portfolio.purposes[0].path).toEqual(before.path);
    expect(portfolio.purposes[0].gaps).toEqual(before.gaps);
  });
});

describe("US-013 purpose lifecycle", () => {
  it("pauses and resumes without changing the saved learning state", () => {
    const statistics = planned("統計", "A/Bテストを判断できる");
    const portfolio = createPortfolio(statistics);
    const paused = setPurposeStatus(portfolio, statistics.purpose.id, "paused", "繁忙期のため休む");
    const resumed = setPurposeStatus(paused, statistics.purpose.id, "active", "再開できる時間ができた");

    expect(paused.purposes[0].purpose.status).toBe("paused");
    expect(resumed.purposes[0].purpose.status).toBe("active");
    expect(resumed.purposes[0].path).toEqual(statistics.path);
    expect(resumed.purposes[0].gaps).toEqual(statistics.gaps);
  });

  it("distinguishes achieved and stopped without manufacturing understanding", () => {
    const achievedState = planned("統計", "判断できる");
    const stoppedState = planned("英語", "説明できる");
    let portfolio = addLearningPurpose(createPortfolio(achievedState), stoppedState);
    portfolio = setPurposeStatus(portfolio, achievedState.purpose.id, "achieved", "必要な判断ができた");
    portfolio = setPurposeStatus(portfolio, stoppedState.purpose.id, "stopped", "別の学びへ移る");

    expect(portfolio.purposes.map((item) => item.purpose.status)).toEqual(["achieved", "stopped"]);
    expect(portfolio.purposes[0].path[0].status).toBe("unconfirmed");
    expect(portfolio.purposes[0].purpose.statusReason).toBe("必要な判断ができた");
  });
});

describe("US-026 allocation review", () => {
  it("keeps allocation separate from understanding and only flags unintended skew", () => {
    const statistics = planned("統計", "判断できる");
    let portfolio = recordAllocation(createPortfolio(statistics), statistics.purpose.id, { depth: "desk", minutes: 45, note: "教材を読んだ" });
    expect(portfolio.purposes[0].allocations[0].minutes).toBe(45);
    expect(portfolio.purposes[0].checkHistory).toHaveLength(0);

    portfolio = reflectOnAllocation(portfolio, statistics.purpose.id, "intentional", "試験前だから");
    expect(portfolio.purposes[0].allocationReflection?.judgment).toBe("intentional");
    portfolio = reflectOnAllocation(portfolio, statistics.purpose.id, "unintended", "惰性で続けた");
    expect(portfolio.purposes[0].allocationReflection?.judgment).toBe("unintended");
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

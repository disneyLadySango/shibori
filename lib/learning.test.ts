import { describe, expect, it } from "vitest";

import {
  applyCheckResult,
  chooseFocus,
  completeReinforcement,
  createLearningState,
  deferGap,
  challengeUnderstanding,
  explainFocus,
  learningDataPolicy,
  recordPositionCorrection,
  recordDependencyCorrection,
  resumeLearning,
  deriveNextMove,
  explainGapRelation,
  prioritizeOpenGaps,
  setLearningPlan,
  summarizeRemaining,
  updateLearningRhythm,
  assessTargetAchievement,
  reviewAllocationProgress,
  reconsiderTarget,
  rejectFocus,
} from "./learning";
import type { LearningPathNode, LearningState } from "./types";

const nodes: LearningPathNode[] = [
  { id: "foundation", title: "標本分布を説明できる", dependsOn: [], status: "unconfirmed" },
  { id: "p-value", title: "p値を説明できる", dependsOn: ["foundation"], status: "unconfirmed" },
  { id: "decision", title: "A/Bテストを判断できる", dependsOn: ["p-value"], status: "unconfirmed" },
];

describe("US-001 exploration", () => {
  it("starts from curiosity without a target state or priority penalty", () => {
    const state = createLearningState({ purpose: "量子力学が面白そう", role: "", why: "" });
    expect(state.phase).toBe("exploring");
    expect(state.targetState).toBeNull();
    expect(state.purpose.priority).toBe("normal");
  });

  it("keeps exploring or forms a Can after an exploration", () => {
    const state = createLearningState({ purpose: "量子力学が面白そう", role: "", why: "" });
    const exploring = chooseFocus(state, { id: "e1", kind: "explore", title: "重ね合わせの概観をつかむ", reason: "興味の輪郭を見つけるため", nodeId: null });
    expect(exploring.phase).toBe("exploring");
    expect(exploring.focus?.title).toContain("重ね合わせ");
    expect(setLearningPlan(exploring, "重ね合わせを自分の言葉で説明できる", nodes).phase).toBe("learning");
  });
});

describe("Wave 3 context adaptation", () => {
  it("separates unknown remainder from observed gaps", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes);
    const remaining = summarizeRemaining({ ...state, path: state.path.map((node, index) => ({ ...node, status: index === 0 ? "gap" : "unconfirmed" })) });
    expect(remaining.gaps).toHaveLength(1); expect(remaining.unconfirmed).toHaveLength(2); expect(remaining.note).toContain("未確認");
  });
  it("updates ongoing rhythm without rewriting allocations", () => {
    const state = { ...createLearningState({ purpose: "統計", role: "", why: "" }), allocations: [{ id: "a", depth: "deep" as const, minutes: 30, note: "過去", recordedAt: "before" }] };
    const updated = updateLearningRhythm(state, { lightMinutes: 20, deepMinutes: 10, note: "通勤変更" });
    expect(updated.rhythm?.deepMinutes).toBe(10); expect(updated.allocations).toEqual(state.allocations);
  });
  it("changes one focus with its reason without manufacturing a gap", () => {
    const state = chooseFocus(setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes), { id: "f", kind: "learn", title: "標本分布", reason: "推奨", nodeId: "foundation" });
    const changed = rejectFocus(state, "今日は計算できない", "change");
    expect(changed.focusDecisions[0].reason).toBe("今日は計算できない"); expect(changed.focus?.nodeId).not.toBe("foundation"); expect(changed.gaps).toEqual([]);
  });
  it("revises the target while preserving prior learning evidence", () => {
    const checked = applyCheckResult(setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes), { nodeId: "foundation", outcome: "confirmed", summary: "説明できた", nextAction: "次", gap: null });
    const revised = reconsiderTarget(checked, "実験を設計できる", ["foundation"]);
    expect(revised.targetRevisions[0].previous).toBe("判断できる"); expect(revised.path[0].status).toBe("confirmed"); expect(revised.checkHistory).toEqual(checked.checkHistory); expect(revised.targetRevisions[0].reviewNodeIds).toEqual(["p-value", "decision"]);
  });
});

describe("US-027 target achievement judgment", () => {
  it("uses checks rather than study time and leaves the final decision to the learner", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "A/Bテストを判断できる", nodes);
    let checked: LearningState = { ...state, allocations: [{ id: "a1", depth: "deep", minutes: 300, note: "教材を完了", recordedAt: "2026-07-21" }] };
    for (const node of nodes) checked = applyCheckResult(checked, { nodeId: node.id, outcome: "confirmed", summary: `${node.title}を確認`, nextAction: "次へ", gap: null });
    const assessment = assessTargetAchievement(checked);
    expect(assessment.status).toBe("ready_for_decision");
    expect(assessment.basis).toHaveLength(3);
    expect(assessment.finalDecisionOwner).toBe("learner");
    expect(checked.purpose.status).toBe("active");
  });

  it("does not infer achievement from consumed time and identifies remaining checks", () => {
    const state = { ...setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes), allocations: [{ id: "a1", depth: "deep" as const, minutes: 999, note: "全教材", recordedAt: "2026-07-21" }] };
    const assessment = assessTargetAchievement(state);
    expect(assessment.status).toBe("checks_remaining");
    expect(assessment.remaining).toEqual(nodes.map((node) => node.title));
    expect(assessment.reason).toContain("時間");
  });
});

describe("US-009 allocation review", () => {
  it("separates invested attention from confirmed progress", () => {
    const state = { ...setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes), allocations: [{ id: "a1", depth: "deep" as const, minutes: 180, note: "教材", recordedAt: "2026-07-21" }] };
    const review = reviewAllocationProgress(state);
    expect(review.investedMinutes).toBe(180);
    expect(review.confirmedCount).toBe(0);
    expect(review.judgment).toBe("投入量だけでは接近を判断できない");
  });

  it("reflects unintended skew without prescribing equal allocation", () => {
    const state = { ...createLearningState({ purpose: "統計", role: "", why: "" }), allocationReflection: { judgment: "unintended" as const, reason: "惰性で耳だけに偏った", recordedAt: "2026-07-21" } };
    const review = reviewAllocationProgress(state);
    expect(review.nextAllocationReason).toContain("惰性で耳だけに偏った");
    expect(review.nextAllocationReason).not.toContain("均等");
  });
});

describe("US-019 focus explanation", () => {
  it("traces a recommendation to purpose, target, current position, and understanding", () => {
    const checked = applyCheckResult(
      setLearningPlan(createLearningState({ purpose: "統計を知りたい", role: "PM", why: "判断したい" }), "A/Bテストを判断できる", nodes),
      { nodeId: "foundation", outcome: "confirmed", summary: "説明できた", nextAction: "p値へ進む", gap: null },
    );

    const explanation = explainFocus(checked);

    expect(explanation.basis.map((item) => item.label)).toEqual(["学習目的", "到達状態", "現在地", "理解状態"]);
    expect(explanation.basis.find((item) => item.label === "理解状態")?.certainty).toBe("confirmed");
  });

  it("marks missing evidence as uncertainty instead of a confirmed result", () => {
    const state = chooseFocus(createLearningState({ purpose: "量子力学", role: "", why: "" }), {
      id: "explore", kind: "explore", title: "概観", reason: "入口", nodeId: null,
    });

    const explanation = explainFocus(state);

    expect(explanation.uncertainty).toContain("到達状態はまだ決まっていません");
    expect(explanation.basis.some((item) => item.certainty === "unknown")).toBe(true);
  });
});

describe("US-022 honest judgment boundaries", () => {
  it("keeps the state unchanged when a requested position cannot be judged", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes);
    expect(recordPositionCorrection(state, { nodeId: "missing", reason: "ここだと思う" })).toBe(state);
  });

  it("distinguishes a learner choice from a personalized or demo judgment", () => {
    const state = recordPositionCorrection(
      setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes),
      { nodeId: "p-value", reason: "先に試したい" },
    );
    expect(state.focus?.source).toBe("learner");
    const inferred = applyCheckResult(state, { nodeId: "p-value", outcome: "confirmed", summary: "説明できた", nextAction: "進む", gap: null });
    expect(inferred.focus?.source).toBe("inferred");
  });
});

describe("US-028 learning state transparency", () => {
  it("states what is recorded, why it is used, and where it is shared", () => {
    expect(learningDataPolicy.recorded).toContain("訂正履歴");
    expect(learningDataPolicy.use).toContain("OpenAI API");
    expect(learningDataPolicy.sharing).toContain("他の学習者へは共有しない");
  });
});

describe("US-016 position correction", () => {
  it("records the previous decision and changes focus without changing understanding", () => {
    const state = applyCheckResult(
      setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes),
      { nodeId: "foundation", outcome: "confirmed", summary: "説明できた", nextAction: "p値", gap: null },
    );
    const beforePath = state.path;
    const beforeChecks = state.checkHistory;

    const corrected = recordPositionCorrection(state, { nodeId: "decision", reason: "実務で先に判断を試したい" });

    expect(corrected.positionCorrections[0]).toMatchObject({ previousNodeId: "p-value", nodeId: "decision" });
    expect(corrected.currentNodeId).toBe("decision");
    expect(corrected.focus?.source).toBe("learner");
    expect(corrected.path).toEqual(beforePath);
    expect(corrected.checkHistory).toEqual(beforeChecks);
  });

  it("preserves the previous dependency and unrelated understanding when correcting the path", () => {
    const state = applyCheckResult(
      setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes),
      { nodeId: "foundation", outcome: "confirmed", summary: "説明できた", nextAction: "進む", gap: null },
    );
    const checks = state.checkHistory;

    const corrected = recordDependencyCorrection(state, { nodeId: "decision", dependsOn: ["foundation"], reason: "p値を経由せず判断練習できる" });

    expect(corrected.path.find((node) => node.id === "decision")?.dependsOn).toEqual(["foundation"]);
    expect(corrected.positionCorrections[0]).toMatchObject({ kind: "dependency", previousDependsOn: ["p-value"], nextDependsOn: ["foundation"] });
    expect(corrected.checkHistory).toEqual(checks);
    expect(corrected.path.find((node) => node.id === "foundation")?.status).toBe("confirmed");
  });

  it("rejects a dependency correction that would create a cycle", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes);
    expect(recordDependencyCorrection(state, { nodeId: "foundation", dependsOn: ["decision"], reason: "逆だと思う" })).toBe(state);
  });
});

describe("US-029 understanding challenge", () => {
  it("records an objection without overwriting the original result", () => {
    const state = applyCheckResult(
      setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes),
      { nodeId: "foundation", outcome: "gap", summary: "説明不足", nextAction: "補う", gap: { id: "g1", topic: "標本分布", reason: "不足", impact: "判断できない", returnNodeId: "foundation" } },
    );

    const challenged = challengeUnderstanding(state, "具体例は説明したので再確認したい");

    expect(challenged.checkChallenges[0]).toMatchObject({ nodeId: "foundation", status: "pending" });
    expect(challenged.checkHistory).toEqual(state.checkHistory);
    expect(challenged.path).toEqual(state.path);
  });

  it("preserves the old result and links an additional check as the resolution", () => {
    const checked = applyCheckResult(
      setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes),
      { nodeId: "foundation", outcome: "gap", summary: "説明不足", nextAction: "補う", gap: { id: "g1", topic: "標本分布", reason: "不足", impact: "判断できない", returnNodeId: "foundation" } },
    );
    const challenged = challengeUnderstanding(checked, "再確認したい");
    const reviewed = applyCheckResult(challenged, { nodeId: "foundation", outcome: "confirmed", summary: "追加説明で確認", nextAction: "進む", gap: null });

    expect(reviewed.checkHistory.map((item) => item.outcome)).toEqual(["gap", "confirmed"]);
    expect(reviewed.checkChallenges[0]).toMatchObject({ status: "reviewed", resolutionCheckIndex: 1 });
    expect(reviewed.gaps.find((gap) => gap.id === "g1")?.status).toBe("resolved");
  });
});

describe("US-002 current position", () => {
  it("keeps dependency branches and one current position", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計を知りたい", role: "", why: "" }), "A/Bテストを判断できる", nodes);
    expect(state.path).toHaveLength(3);
    expect(state.currentNodeId).toBe("foundation");
    expect(state.path.find((node) => node.id === "p-value")?.dependsOn).toEqual(["foundation"]);
  });

  it("does not present unknown dependencies as confirmed", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", [
      ...nodes,
      { id: "unknown", title: "未確認の前提", dependsOn: [], status: "unknown" },
    ]);
    expect(state.path.find((node) => node.id === "unknown")?.status).toBe("unknown");
  });

  it("does not accept model-proposed confirmation without a check", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", [
      { id: "claimed", title: "教材に書かれた内容", dependsOn: [], status: "confirmed" },
    ]);
    expect(state.path[0].status).toBe("unconfirmed");
  });

  it("keeps a current position while dependency knowledge is still unknown", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", [
      { id: "unknown", title: "関係を確認する", dependsOn: [], status: "unknown" },
    ]);
    expect(state.currentNodeId).toBe("unknown");
  });
});

describe("US-003 one focus", () => {
  it("stores only one recommended focus", () => {
    const state = createLearningState({ purpose: "統計", role: "", why: "" });
    const first = chooseFocus(state, { id: "f1", kind: "explore", title: "概観", reason: "入口", nodeId: null });
    const second = chooseFocus(first, { id: "f2", kind: "explore", title: "事例", reason: "別案", nodeId: null });
    expect(second.focus?.id).toBe("f2");
  });

  it("allows the learner to replace a recommendation", () => {
    const state = createLearningState({ purpose: "統計", role: "", why: "" });
    expect(chooseFocus(state, { id: "mine", kind: "explore", title: "自分で選ぶ", reason: "今の関心", nodeId: null }).focus?.id).toBe("mine");
  });
});

describe("US-005 understanding checks", () => {
  it("does not change understanding from material exposure", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes);
    expect(state.path.every((node) => node.status !== "confirmed")).toBe(true);
  });

  it("updates only the checked node with the reason", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes);
    const checked = applyCheckResult(state, { nodeId: "foundation", outcome: "confirmed", summary: "標本分布を説明できた", nextAction: "p値へ進む", gap: null });
    expect(checked.path.find((node) => node.id === "foundation")?.status).toBe("confirmed");
    expect(checked.lastCheck?.summary).toContain("説明できた");
  });

  it("keeps partial failure scoped to the checked node", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes);
    const checked = applyCheckResult(state, { nodeId: "p-value", outcome: "gap", summary: "定義は説明できるが解釈を誤った", nextAction: "解釈を補う", gap: { id: "g1", topic: "p値の解釈", reason: "確率の向きを混同", impact: "判断を誤る", returnNodeId: "p-value" } });
    expect(checked.gaps[0].topic).toBe("p値の解釈");
    expect(checked.path.find((node) => node.id === "foundation")?.status).toBe("unconfirmed");
  });
});

describe("US-006 reinforcement return", () => {
  it("recommends one reinforcement and preserves the return point", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes);
    const checked = applyCheckResult(state, { nodeId: "p-value", outcome: "gap", summary: "前提不足", nextAction: "標本分布を補う", gap: { id: "g1", topic: "標本分布", reason: "p値の前提", impact: "p値を説明できない", returnNodeId: "p-value" } });
    expect(checked.focus?.kind).toBe("reinforce");
    expect(checked.focus?.reason).toContain("p値");
    expect(checked.gaps[0].returnNodeId).toBe("p-value");
  });

  it("returns to the saved node after reinforcement", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes);
    const checked = applyCheckResult(state, { nodeId: "p-value", outcome: "gap", summary: "前提不足", nextAction: "補う", gap: { id: "g1", topic: "標本分布", reason: "前提", impact: "説明できない", returnNodeId: "p-value" } });
    expect(completeReinforcement(checked, "g1").currentNodeId).toBe("p-value");
  });
});

describe("US-007 reallocation", () => {
  it("moves past confirmed work without changing unrelated nodes", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes);
    const checked = applyCheckResult(state, { nodeId: "foundation", outcome: "confirmed", summary: "説明できた", nextAction: "p値", gap: null });
    expect(checked.currentNodeId).toBe("p-value");
    expect(checked.path.find((node) => node.id === "decision")?.status).toBe("unconfirmed");
  });

  it("reallocates to a gap without rebuilding the path", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes);
    const checked = applyCheckResult(state, { nodeId: "p-value", outcome: "gap", summary: "不足", nextAction: "補強", gap: { id: "g1", topic: "標本分布", reason: "前提", impact: "説明できない", returnNodeId: "p-value" } });
    expect(checked.path.map((node) => node.id)).toEqual(nodes.map((node) => node.id));
    expect(checked.focus?.kind).toBe("reinforce");
  });
});

describe("US-008 resume", () => {
  it("restores the saved focus and current position", () => {
    const state = chooseFocus(setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes), { id: "f1", kind: "learn", title: "標本分布", reason: "現在地", nodeId: "foundation" });
    expect(resumeLearning(JSON.stringify(state)).focus?.id).toBe("f1");
    expect(resumeLearning(JSON.stringify(state)).currentNodeId).toBe("foundation");
  });

  it("does not invent unresolved state when resuming", () => {
    const state = createLearningState({ purpose: "統計", role: "", why: "" });
    const resumed = resumeLearning(JSON.stringify(state));
    expect(resumed.targetState).toBeNull();
    expect(resumed.focus).toBeNull();
  });
});

describe("US-025 reinforcement timing", () => {
  it("defers reinforcement without clearing the gap or blocking other focus", () => {
    const state = applyCheckResult(setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes), { nodeId: "p-value", outcome: "gap", summary: "不足", nextAction: "補強", gap: { id: "g1", topic: "標本分布", reason: "前提", impact: "説明できない", returnNodeId: "p-value" } });
    const deferred = deferGap(state, "g1");
    const other = chooseFocus(deferred, { id: "other", kind: "learn", title: "効果量", reason: "別の学び", nodeId: "decision" });
    expect(other.gaps[0].status).toBe("deferred");
    expect(other.focus?.id).toBe("other");
    expect(other.path.find((node) => node.id === "p-value")?.status).toBe("gap");
  });

  it("can choose reinforcement now and return afterward", () => {
    const state = applyCheckResult(setLearningPlan(createLearningState({ purpose: "統計", role: "", why: "" }), "判断できる", nodes), { nodeId: "p-value", outcome: "gap", summary: "不足", nextAction: "補強", gap: { id: "g1", topic: "標本分布", reason: "前提", impact: "説明できない", returnNodeId: "p-value" } });
    const completed = completeReinforcement(state, "g1");
    expect(completed.gaps[0].status).toBe("resolved");
    expect(completed.currentNodeId).toBe("p-value");
  });
});

describe("US-023 next move after a check", () => {
  it("advances after confirmation and ties the reason to that result", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "PM", why: "判断したい" }), "A/Bテストを判断できる", nodes);
    const result = { nodeId: "foundation", outcome: "confirmed" as const, summary: "標本分布を説明できた", nextAction: "p値へ進む", gap: null };
    expect(deriveNextMove(state, result)).toEqual(expect.objectContaining({ kind: "advance", title: "p値を説明できる", reason: expect.stringContaining("説明できた") }));
  });

  it("retries only the observed gap with a changed attempt", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "PM", why: "判断したい" }), "A/Bテストを判断できる", nodes);
    const result = { nodeId: "p-value", outcome: "gap" as const, summary: "定義は説明できたが解釈が不足", nextAction: "具体例で確かめる", gap: { id: "g1", topic: "p値の解釈", reason: "解釈が不足", impact: "判断を誤る", returnNodeId: "p-value" } };
    const move = deriveNextMove(state, result);
    expect(move).toEqual(expect.objectContaining({ kind: "retry", scope: "p値の解釈", preserved: "定義は説明できたが解釈が不足" }));
    expect(move.reason).toContain("解釈が不足");
  });
});

describe("US-030 gap priority", () => {
  it("recommends one impactful gap and preserves the others", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "PM", why: "判断したい" }), "A/Bテストを判断できる", nodes);
    const withGaps = { ...state, gaps: [
      { id: "g1", topic: "標本分布", reason: "前提", impact: "p値を説明できない", returnNodeId: "p-value", status: "deferred" as const },
      { id: "g2", topic: "効果量", reason: "判断に必要", impact: "到達状態の判断を誤る", returnNodeId: "decision", status: "recommended" as const },
      { id: "g3", topic: "歴史", reason: "背景", impact: "到達状態との関係は未確認", returnNodeId: "missing", status: "deferred" as const },
    ] };
    const priority = prioritizeOpenGaps(withGaps);
    expect(priority?.gap.id).toBe("g1");
    expect(priority?.remaining.map((gap) => gap.id)).toEqual(["g2", "g3"]);
    expect(withGaps.gaps.map((gap) => gap.status)).toEqual(["deferred", "recommended", "deferred"]);
  });
});

describe("US-015 prerequisite relation", () => {
  it("explains a known path relation without forcing its timing", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "PM", why: "判断したい" }), "A/Bテストを判断できる", nodes);
    const relation = explainGapRelation(state, { id: "g1", topic: "標本分布", reason: "前提", impact: "p値を説明できない", returnNodeId: "p-value", status: "recommended" });
    expect(relation.kind).toBe("required");
    expect(relation.explanation).toContain("p値を説明できる");
    expect(relation.timing).toContain("あなたが決められます");
  });

  it("does not call an unknown relation required", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "PM", why: "判断したい" }), "A/Bテストを判断できる", nodes);
    expect(explainGapRelation(state, { id: "g3", topic: "歴史", reason: "背景", impact: "不明", returnNodeId: "missing", status: "deferred" }).kind).toBe("unknown");
  });
});

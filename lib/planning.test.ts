import { describe, expect, it } from "vitest";

import { buildCheckPrompt, buildLearningPlanPrompt, createDemoLearningPlan, learningPlanSchema } from "./planning";
import { createLearningState, setLearningPlan } from "./learning";

describe("learning plan", () => {
  it("creates an English demo plan without Japanese decision copy", () => {
    const state = createLearningState({ purpose: "Learn statistics", role: "Engineer and PM", why: "Design A/B tests" });
    const plan = createDemoLearningPlan(state, "en");

    expect(plan.focus.title).toContain("Learn statistics");
    expect(plan.focus.reason).toContain("next Can");
    expect(plan.check.prompt).toContain("most interesting");
    expect(JSON.stringify(plan)).not.toMatch(/[ぁ-んァ-ン一-龯]/);
  });

  it("keeps the Japanese demo plan available", () => {
    const state = createLearningState({ purpose: "統計を学ぶ", role: "PM", why: "判断したい" });
    expect(createDemoLearningPlan(state, "ja").focus.reason).toContain("次のCan");
  });

  it("asks GPT-5.6 for one exploration when no target state exists", () => {
    const state = createLearningState({ purpose: "量子力学が面白そう", role: "デザイナー", why: "" });
    const prompt = buildLearningPlanPrompt({ state, material: "" });
    expect(prompt).toContain("学習目的: 量子力学が面白そう");
    expect(prompt).toContain("到達状態を強制しない");
    expect(prompt).toContain("集中先は一つだけ");
  });

  it("uses one schema for exploration and learning plans", () => {
    expect(learningPlanSchema.safeParse(createDemoLearningPlan(createLearningState({ purpose: "統計", role: "PM", why: "" }))).success).toBe(true);
  });

  it("creates a visible first current position for a newly declared Can", () => {
    const state = { ...createLearningState({ purpose: "統計", role: "PM", why: "" }), phase: "learning" as const, targetState: "A/Bテストを判断できる" };
    const plan = createDemoLearningPlan(state);
    expect(plan.path).toHaveLength(1);
    expect(plan.currentNodeId).toBe("target");
  });

  it("includes path, gaps, and the current recommendation when replanning", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "PM", why: "A/Bテスト" }), "A/Bテストを判断できる", [
      { id: "p-value", title: "p値を説明できる", dependsOn: [], status: "gap" },
    ]);
    state.gaps.push({ id: "g1", topic: "標本分布", reason: "前提", impact: "p値を説明できない", returnNodeId: "p-value", status: "deferred" });
    const prompt = buildLearningPlanPrompt({ state, material: "教材" });
    expect(prompt).toContain("p値を説明できる");
    expect(prompt).toContain("標本分布");
    expect(prompt).toContain("deferred");
  });
});

describe("understanding check prompt", () => {
  it("distinguishes exposure from a check and scopes partial failure", () => {
    const state = setLearningPlan(createLearningState({ purpose: "統計", role: "PM", why: "" }), "p値を説明できる", [
      { id: "p-value", title: "p値を説明できる", dependsOn: [], status: "unconfirmed" },
    ]);
    const prompt = buildCheckPrompt({ state, prompt: "p値を説明してください", answer: "小さいほど仮説が誤り" });
    expect(prompt).toContain("読んだ・聞いたことを理解確認にしない");
    expect(prompt).toContain("できなかった部分だけ");
  });
});

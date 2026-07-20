import { describe, expect, it } from "vitest";

import { buildEvaluationPrompt, buildProjectionPrompt, createDemoEvaluation, createDemoProjection } from "./shibori";

describe("buildProjectionPrompt", () => {
  it("combines material, context, and unresolved gaps", () => {
    const prompt = buildProjectionPrompt({
      context: { role: "エンジニア兼PM", goal: "統計を学びたい", why: "A/Bテストを設計したい", updatedAt: "now" },
      material: "仮説検定の教材",
      gaps: [{ id: "g1", topic: "標準誤差", reason: "未理解", source: "user_reported", resolved: false }],
    });

    expect(prompt).toContain("エンジニア兼PM");
    expect(prompt).toContain("仮説検定の教材");
    expect(prompt).toContain("標準誤差");
    expect(prompt).toContain("補講パートを講義スクリプト冒頭に挿入");
  });
});

describe("desk task evaluation", () => {
  it("asks GPT-5.6 to judge reasoning in the learner context", () => {
    const prompt = buildEvaluationPrompt({
      context: { role: "PM", goal: "統計", why: "A/Bテスト", updatedAt: "now" },
      problem: "z統計量を求めて判断してください",
      answer: "zは2なので棄却する",
    });

    expect(prompt).toContain("zは2なので棄却する");
    expect(prompt).toContain("A/Bテスト");
    expect(prompt).toContain("最終結論だけでなく途中の考え方");
  });

  it("turns an incomplete demo answer into an actionable gap", () => {
    const result = createDemoEvaluation("計算方法がわかりません");

    expect(result.verdict).toBe("retry");
    expect(result.gap?.topic).toBe("z統計量の計算");
    expect(result.nextAction).toBeTruthy();
  });
});

describe("createDemoProjection", () => {
  it("returns the sample split as three ear segments and one desk segment", () => {
    const projection = createDemoProjection({ role: "エンジニア兼PM", goal: "統計", why: "A/Bテスト", updatedAt: "now" }, []);

    expect(projection.segments.filter((segment) => segment.mode === "ear")).toHaveLength(3);
    expect(projection.segments.filter((segment) => segment.mode === "desk")).toHaveLength(1);
    expect(projection.earScript).toContain("A/Bテスト");
  });

  it("adds an unresolved gap refresher to the beginning", () => {
    const projection = createDemoProjection(
      { role: "PM", goal: "統計", why: "意思決定", updatedAt: "now" },
      [{ id: "g1", topic: "p値", reason: "未理解", source: "user_reported", resolved: false }],
    );

    expect(projection.earScript.startsWith("【補講：p値】")).toBe(true);
  });
});

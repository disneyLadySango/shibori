import { describe, expect, it } from "vitest";

import { buildEvaluationPrompt, buildProjectionPrompt, createDemoEvaluation, createDemoProjection, normalizeProjection, projectionSchema } from "./shibori";

describe("buildProjectionPrompt", () => {
  it("combines material, context, and unresolved gaps", () => {
    const prompt = buildProjectionPrompt({
      context: { role: "エンジニア兼PM", goal: "統計を学びたい", why: "A/Bテストを設計したい", updatedAt: "now" },
      material: "仮説検定の教材",
      gaps: [{ id: "g1", topic: "標準誤差", reason: "未理解", source: "user_reported", resolved: false }],
      focusResource: { minutes: 15, attention: "light" },
      learningPosition: { targetState: "A/Bテストを判断できる", current: "p値", focus: "p値を説明する" },
    });

    expect(prompt).toContain("エンジニア兼PM");
    expect(prompt).toContain("仮説検定の教材");
    expect(prompt).toContain("標準誤差");
    expect(prompt).toContain("補講パートを講義スクリプト冒頭に挿入");
    expect(prompt).toContain("15分");
    expect(prompt).toContain("軽い集中");
    expect(prompt).toContain("今の集中先に使う");
    expect(prompt).toContain("関係を判断できない");
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
  it("selects one light-focus part and keeps the four-way material map", () => {
    const projection = createDemoProjection(
      { role: "エンジニア兼PM", goal: "統計", why: "A/Bテスト", updatedAt: "now" }, [],
      { minutes: 15, attention: "light" },
    );

    expect(projection.fit.status).toBe("ready");
    expect(projection.selected?.attention).toBe("light");
    expect(projection.segments.filter((segment) => segment.position === "now")).toHaveLength(1);
    expect(projection.segments.some((segment) => segment.position === "later")).toBe(true);
    expect(projection.earScript).toContain("A/Bテスト");
    expect(projection.deskTask).toBeNull();
  });

  it("rejects a no-fit result that still selects learning content", () => {
    const invalid = {
      ...createDemoProjection({ role: "PM", goal: "統計", why: "判断", updatedAt: "now" }, [], { minutes: 2, attention: "light" as const }),
      selected: { text: "無理な課題", attention: "deep", reason: "短縮" },
    };

    expect(projectionSchema.safeParse(invalid).success).toBe(false);
  });

  it("accepts exactly one selected part for a ready result", () => {
    const ready = createDemoProjection(
      { role: "PM", goal: "統計", why: "判断", updatedAt: "now" }, [],
      { minutes: 15, attention: "light" },
    );
    expect(projectionSchema.safeParse(ready).success).toBe(true);
  });

  it("aligns the material map with the model's selected part", () => {
    const ready = createDemoProjection(
      { role: "PM", goal: "統計", why: "判断", updatedAt: "now" }, [],
      { minutes: 15, attention: "light" },
    );
    const inconsistent = {
      ...ready,
      segments: ready.segments.map((segment) => ({ ...segment, position: "later" as const })),
    };

    const normalized = normalizeProjection(inconsistent);

    expect(normalized.segments.filter((segment) => segment.position === "now")).toHaveLength(1);
    expect(normalized.segments.find((segment) => segment.position === "now")?.text).toBe(ready.selected?.text);
  });

  it("adds an unresolved gap refresher to the beginning", () => {
    const projection = createDemoProjection(
      { role: "PM", goal: "統計", why: "意思決定", updatedAt: "now" },
      [{ id: "g1", topic: "p値", reason: "未理解", source: "user_reported", resolved: false }],
      { minutes: 15, attention: "light" },
    );

    expect(projection.earScript?.startsWith("【補講：p値】")).toBe(true);
  });

  it("selects one deep-focus task without manufacturing an ear task", () => {
    const projection = createDemoProjection(
      { role: "PM", goal: "統計", why: "判断", updatedAt: "now" }, [],
      { minutes: 20, attention: "deep" },
    );

    expect(projection.selected?.attention).toBe("deep");
    expect(projection.deskTask).not.toBeNull();
    expect(projection.earScript).toBeNull();
  });

  it("returns a reasoned no-fit result when the resource cannot preserve the learning", () => {
    const projection = createDemoProjection(
      { role: "PM", goal: "統計", why: "判断", updatedAt: "now" }, [],
      { minutes: 2, attention: "light" },
    );

    expect(projection.fit.status).toBe("no_fit");
    expect(projection.selected).toBeNull();
    expect(projection.fit.reason).toContain("2分");
    expect(projection.earScript).toBeNull();
    expect(projection.deskTask).toBeNull();
  });
});

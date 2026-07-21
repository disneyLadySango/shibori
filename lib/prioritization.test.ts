import { describe, expect, it } from "vitest";

import { createLearningState } from "./learning";
import { addLearningPurpose, createPortfolio, reflectOnAllocation, setPurposeStatus, updatePurposeContext } from "./portfolio";
import { buildPurposeRecommendationPrompt, createDemoPurposeRecommendation, purposeRecommendationOutputSchema } from "./prioritization";

describe("purpose prioritization", () => {
  it("asks for exactly one recommendation while preserving learner ownership", () => {
    const statistics = createLearningState({ purpose: "統計", role: "PM", why: "仕事で使う" });
    const physics = createLearningState({ purpose: "量子力学が面白そう", role: "PM", why: "知りたい" });
    const prompt = buildPurposeRecommendationPrompt(addLearningPurpose(createPortfolio(statistics), physics), "深い集中を30分");

    expect(prompt).toContain("統計");
    expect(prompt).toContain("量子力学が面白そう");
    expect(prompt).toContain("一つだけ");
    expect(prompt).toContain("最終的に選ぶのは学習者");
  });

  it("uses current context and unintended skew while excluding paused purposes", () => {
    const statistics = createLearningState({ purpose: "統計", role: "PM", why: "判断したい" });
    const english = createLearningState({ purpose: "英語", role: "PM", why: "話したい" });
    let portfolio = addLearningPurpose(createPortfolio(statistics), english);
    portfolio = updatePurposeContext(portfolio, statistics.purpose.id, { deadline: "2026-08-01", importance: "high", usageContext: "A/Bテスト会議" });
    portfolio = reflectOnAllocation(portfolio, statistics.purpose.id, "unintended", "英語を後回しにしていた");
    portfolio = setPurposeStatus(portfolio, english.purpose.id, "paused", "休憩");
    const prompt = buildPurposeRecommendationPrompt(portfolio, "30分");

    expect(prompt).toContain("2026-08-01");
    expect(prompt).toContain("A/Bテスト会議");
    expect(prompt).toContain("英語を後回しにしていた");
    expect(prompt).not.toContain("### 2. 英語");
  });

  it("does not penalize curiosity for lacking a deadline or practical use", () => {
    const practical = createLearningState({ purpose: "資格試験", role: "", why: "仕事" });
    const curiosity = createLearningState({ purpose: "宇宙論を知りたい", role: "", why: "面白い" });
    const prompt = buildPurposeRecommendationPrompt(addLearningPurpose(createPortfolio(practical), curiosity), "未入力");

    expect(prompt).toContain("期限や実用性がないことだけを理由に低く扱わない");
  });

  it("returns one existing purpose through the strict output shape", () => {
    const first = createLearningState({ purpose: "統計", role: "", why: "" });
    const second = createLearningState({ purpose: "英語", role: "", why: "" });
    const portfolio = addLearningPurpose(createPortfolio(first), second);
    const recommendation = createDemoPurposeRecommendation(portfolio);

    expect(purposeRecommendationOutputSchema.safeParse(recommendation).success).toBe(true);
    expect(portfolio.purposes.some((state) => state.purpose.id === recommendation.purposeId)).toBe(true);
  });

  it("changes the demo recommendation when current importance changes", () => {
    const statistics = createLearningState({ purpose: "統計", role: "", why: "" });
    const english = createLearningState({ purpose: "英語", role: "", why: "" });
    let portfolio = addLearningPurpose(createPortfolio(statistics), english);
    portfolio = updatePurposeContext(portfolio, english.purpose.id, { deadline: null, importance: "high", usageContext: "来週の発表" });

    expect(createDemoPurposeRecommendation(portfolio).purposeId).toBe(english.purpose.id);
  });
});

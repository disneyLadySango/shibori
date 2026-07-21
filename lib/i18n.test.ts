import { describe, expect, it } from "vitest";

import { gapPriorityReason } from "./i18n";

describe("English dialog copy", () => {
  it("explains gap priority without mixing Japanese", () => {
    const reason = gapPriorityReason("en");

    expect(reason).toContain("target state");
    expect(reason).not.toMatch(/[ぁ-んァ-ン一-龯]/);
  });
});

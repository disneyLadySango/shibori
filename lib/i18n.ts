import { z } from "zod";

export const dialogLanguageSchema = z.enum(["en", "ja"]);
export type DialogLanguage = z.infer<typeof dialogLanguageSchema>;

export const defaultDialogLanguage: DialogLanguage = "en";

export function languageInstruction(language: DialogLanguage) {
  return language === "en"
    ? "Respond in natural English. Do not mix in Japanese except for proper nouns supplied by the learner."
    : "自然な日本語で返してください。学習者が入力した固有名詞を除き、英語を混在させないでください。";
}

export function gapPriorityReason(language: DialogLanguage) {
  return language === "en"
    ? "This is the one unresolved gap with the strongest impact on the current target state."
    : "未解決の抜けのうち、現在の到達状態への影響が最も大きい一件です。";
}

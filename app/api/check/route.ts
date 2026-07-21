import { NextResponse } from "next/server";
import { z } from "zod";

import { learningStateSchema } from "@/lib/learning";
import { checkUnderstanding } from "@/lib/openai";
import { createDemoCheckResult } from "@/lib/planning";
import { dialogLanguageSchema } from "@/lib/i18n";

const requestSchema = z.object({
  state: learningStateSchema,
  prompt: z.string().min(1).max(2_000),
  answer: z.string().min(1).max(10_000),
  language: dialogLanguageSchema.default("ja"),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "理解確認への回答を入力してください。" }, { status: 400 });

  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ...createDemoCheckResult(parsed.data.state, parsed.data.answer, parsed.data.language), source: "demo" });

  try {
    return NextResponse.json({ ...await checkUnderstanding(parsed.data), source: "gpt-5.6" });
  } catch (error) {
    console.error("Understanding check failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: parsed.data.language === "en"
      ? "We couldn't assess your understanding this time. Earlier results are unchanged, and you can retry with the same answer."
      : "今回は理解状態を判断できませんでした。以前の確認結果は変更していません。回答を保って再試行できます。" }, { status: 502 });
  }
}

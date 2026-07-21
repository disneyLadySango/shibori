import { NextResponse } from "next/server";
import { z } from "zod";

import { learningStateSchema } from "@/lib/learning";
import { planLearning } from "@/lib/openai";
import { createDemoLearningPlan } from "@/lib/planning";
import { dialogLanguageSchema } from "@/lib/i18n";

const requestSchema = z.object({
  state: learningStateSchema,
  material: z.string().max(30_000).optional(),
  language: dialogLanguageSchema.default("ja"),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "学習目的と現在の状態を確認してください。" }, { status: 400 });

  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ...createDemoLearningPlan(parsed.data.state, parsed.data.language), source: "demo" });

  try {
    return NextResponse.json({ ...await planLearning(parsed.data), source: "gpt-5.6" });
  } catch (error) {
    console.error("Learning plan failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: parsed.data.language === "en"
      ? "We couldn't choose a personalized focus this time. Your learning state is unchanged; retry shortly or choose a different focus yourself."
      : "今回は個別の集中先を判断できませんでした。学習状態は変更していません。少し待って再試行するか、自分で別の学びを選べます。" }, { status: 502 });
  }
}

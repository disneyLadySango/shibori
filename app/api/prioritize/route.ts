import { NextResponse } from "next/server";
import { z } from "zod";

import { recommendLearningPurpose } from "@/lib/openai";
import { learningPortfolioSchema } from "@/lib/portfolio";
import { createDemoPurposeRecommendation } from "@/lib/prioritization";

const requestSchema = z.object({
  portfolio: learningPortfolioSchema,
  availableFocus: z.string().max(500),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "学習目的と現在の状態を確認してください。" }, { status: 400 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ...createDemoPurposeRecommendation(parsed.data.portfolio), source: "demo" });
  }

  try {
    return NextResponse.json({ ...await recommendLearningPurpose(parsed.data), source: "gpt-5.6" });
  } catch (error) {
    console.error("Purpose recommendation failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "次に集中する学習目的をおすすめできませんでした。選択中の目的は変更していません。" }, { status: 502 });
  }
}

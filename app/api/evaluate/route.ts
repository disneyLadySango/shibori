import { NextResponse } from "next/server";
import { z } from "zod";

import { evaluateDeskAnswer } from "@/lib/openai";
import { createDemoEvaluation } from "@/lib/shibori";

const requestSchema = z.object({
  context: z.object({ role: z.string().min(1), goal: z.string().min(1), why: z.string().min(1), updatedAt: z.string() }),
  problem: z.string().min(10).max(4_000),
  answer: z.string().min(2).max(4_000),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "考えたことをもう少し書いてください。" }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json(createDemoEvaluation(parsed.data.answer));

  try {
    return NextResponse.json(await evaluateDeskAnswer(parsed.data));
  } catch (error) {
    console.error("Desk evaluation failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "回答を評価できませんでした。もう一度お試しください。" }, { status: 502 });
  }
}

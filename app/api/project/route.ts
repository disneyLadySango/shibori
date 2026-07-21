import { NextResponse } from "next/server";
import { z } from "zod";

import { projectMaterial } from "@/lib/openai";
import { createDemoProjection, sampleMaterial } from "@/lib/shibori";

const requestSchema = z.object({
  context: z.object({ role: z.string(), goal: z.string().min(1), why: z.string(), updatedAt: z.string() }),
  material: z.string().min(30).max(30_000),
  gaps: z.array(z.object({
    id: z.string(), topic: z.string(), reason: z.string(),
    source: z.enum(["detected", "user_reported"]), resolved: z.boolean(),
  })),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "入力内容を確認してください。" }, { status: 400 });

  if (!process.env.OPENAI_API_KEY) {
    if (parsed.data.material.trim() !== sampleMaterial.trim()) {
      return NextResponse.json(
        { error: "任意の教材を仕分けるにはOPENAI_API_KEYが必要です。サンプル教材ではデモ動線を確認できます。" },
        { status: 503 },
      );
    }
    return NextResponse.json(createDemoProjection(parsed.data.context, parsed.data.gaps));
  }

  try {
    return NextResponse.json(await projectMaterial(parsed.data));
  } catch (error) {
    console.error("Projection failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "教材を絞れませんでした。少し待ってもう一度お試しください。" }, { status: 502 });
  }
}

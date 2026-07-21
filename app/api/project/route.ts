import { NextResponse } from "next/server";
import { z } from "zod";

import { projectMaterial } from "@/lib/openai";
import { createDemoProjection, sampleMaterial, sampleMaterialEn } from "@/lib/shibori";
import { dialogLanguageSchema } from "@/lib/i18n";

const requestSchema = z.object({
  context: z.object({ role: z.string(), goal: z.string().min(1), why: z.string(), updatedAt: z.string() }),
  material: z.string().min(30).max(30_000),
  gaps: z.array(z.object({
    id: z.string(), topic: z.string(), reason: z.string(),
    source: z.enum(["detected", "user_reported"]), resolved: z.boolean(),
  })),
  focusResource: z.object({ minutes: z.number().int().positive().max(480), attention: z.enum(["light", "deep"]) }),
  learningPosition: z.object({ targetState: z.string().nullable(), current: z.string(), focus: z.string() }),
  language: dialogLanguageSchema.default("ja"),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "入力内容を確認してください。" }, { status: 400 });

  if (!process.env.OPENAI_API_KEY) {
    if (![sampleMaterial.trim(), sampleMaterialEn.trim()].includes(parsed.data.material.trim())) {
      return NextResponse.json(
        { error: parsed.data.language === "en"
          ? "An OpenAI API key is required for custom material. Use the sample material to try the demo flow."
          : "任意の教材を仕分けるにはOPENAI_API_KEYが必要です。サンプル教材ではデモ動線を確認できます。" },
        { status: 503 },
      );
    }
    return NextResponse.json(createDemoProjection(parsed.data.context, parsed.data.gaps, parsed.data.focusResource, parsed.data.language));
  }

  try {
    return NextResponse.json(await projectMaterial(parsed.data));
  } catch (error) {
    console.error("Projection failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: parsed.data.language === "en" ? "We couldn't shape this material. Please wait a moment and retry." : "教材を絞れませんでした。少し待ってもう一度お試しください。" }, { status: 502 });
  }
}

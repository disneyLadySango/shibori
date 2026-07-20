import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({ script: z.string().min(1).max(4_096) });

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "音声再生にはOPENAI_API_KEYが必要です。" }, { status: 503 });
  }
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "講義スクリプトがありません。" }, { status: 400 });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const audio = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "marin",
      input: parsed.data.script,
      instructions: "落ち着いた日本語の講師として、理解の間を取りながら自然に話してください。",
      response_format: "mp3",
    });
    return new Response(await audio.arrayBuffer(), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch (error) {
    console.error("Speech generation failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "音声を生成できませんでした。" }, { status: 502 });
  }
}

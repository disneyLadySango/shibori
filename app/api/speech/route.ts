import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { dialogLanguageSchema } from "@/lib/i18n";

const requestSchema = z.object({ script: z.string().min(1).max(4_096), language: dialogLanguageSchema.default("ja") });

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "講義スクリプトがありません。" }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: parsed.data.language === "en" ? "Audio playback requires an OpenAI API key." : "音声再生にはOPENAI_API_KEYが必要です。" }, { status: 503 });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const audio = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "marin",
      input: parsed.data.script,
      instructions: parsed.data.language === "en"
        ? "Speak as a calm English-language instructor, with natural pauses that support understanding."
        : "落ち着いた日本語の講師として、理解の間を取りながら自然に話してください。",
      response_format: "mp3",
    });
    return new Response(await audio.arrayBuffer(), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch (error) {
    console.error("Speech generation failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: parsed.data.language === "en" ? "We couldn't generate the audio." : "音声を生成できませんでした。" }, { status: 502 });
  }
}

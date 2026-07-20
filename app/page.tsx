"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { sampleMaterial } from "@/lib/shibori";
import type { GapEntry, Projection, UserContext } from "@/lib/types";

const emptyContext: UserContext = { role: "", goal: "", why: "", updatedAt: "" };
const storageKeys = { context: "shibori-context", gaps: "shibori-gaps" };

function Aperture({ active, complete }: { active?: boolean; complete?: boolean }) {
  return (
    <svg className={`aperture ${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {[0, 60, 120, 180, 240, 300].map((rotation) => (
        <path key={rotation} d="M32 7 C44 11 50 19 50 31 L33 34 L21 20 Z" transform={`rotate(${rotation} 32 32)`} fill="currentColor" opacity=".82" />
      ))}
      <circle cx="32" cy="32" r={complete ? 3 : 9} fill="var(--paper)" className="aperture-hole" />
    </svg>
  );
}

function SectionTitle({ number, children }: { number: string; children: React.ReactNode }) {
  return <div className="section-title"><span>{number}</span><h2>{children}</h2></div>;
}

export default function Home() {
  const [context, setContext] = useState<UserContext>(emptyContext);
  const [material, setMaterial] = useState("");
  const [gaps, setGaps] = useState<GapEntry[]>([]);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [contextSaved, setContextSaved] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const savedContext = localStorage.getItem(storageKeys.context);
        const savedGaps = localStorage.getItem(storageKeys.gaps);
        if (savedContext) { setContext(JSON.parse(savedContext)); setContextSaved(true); }
        if (savedGaps) setGaps(JSON.parse(savedGaps));
      } catch {
        localStorage.removeItem(storageKeys.context);
        localStorage.removeItem(storageKeys.gaps);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  function saveContext(event: FormEvent) {
    event.preventDefault();
    const next = { ...context, updatedAt: new Date().toISOString() };
    setContext(next); localStorage.setItem(storageKeys.context, JSON.stringify(next)); setContextSaved(true);
  }

  async function project() {
    setError("");
    if (!context.role || !context.goal || !context.why) { setError("先に、あなたのことを3つ教えてください。"); return; }
    if (material.trim().length < 30) { setError("30文字以上の教材を入れてください。"); return; }
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(""); }
    setLoading(true); setProjection(null);
    try {
      const response = await fetch("/api/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context, material, gaps }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setProjection(body);
      const detected: GapEntry[] = body.gaps.map((gap: { topic: string; reason: string }) => ({ id: crypto.randomUUID(), ...gap, source: "detected", resolved: false }));
      const next = [...gaps, ...detected.filter((gap) => !gaps.some((existing) => existing.topic === gap.topic))];
      setGaps(next); localStorage.setItem(storageKeys.gaps, JSON.stringify(next));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "教材を絞れませんでした。"); }
    finally { setLoading(false); }
  }

  function reportGap(segment: Projection["segments"][number]) {
    const topic = segment.text.replace(/[。、]/g, "").slice(0, 24);
    if (gaps.some((gap) => gap.topic === topic && !gap.resolved)) return;
    const next = [...gaps, { id: crypto.randomUUID(), topic, reason: `「${segment.text}」がわからなかった`, source: "user_reported" as const, resolved: false }];
    setGaps(next); localStorage.setItem(storageKeys.gaps, JSON.stringify(next));
  }

  function resolveGap(id: string) {
    const next = gaps.map((gap) => gap.id === id ? { ...gap, resolved: true } : gap);
    setGaps(next); localStorage.setItem(storageKeys.gaps, JSON.stringify(next));
  }

  async function playLecture() {
    if (!projection) return;
    if (audioUrl) { await audioRef.current?.play(); return; }
    setAudioLoading(true); setError("");
    try {
      const response = await fetch("/api/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script: projection.earScript }) });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error); }
      const nextUrl = URL.createObjectURL(await response.blob()); setAudioUrl(nextUrl);
      requestAnimationFrame(() => audioRef.current?.play());
    } catch (caught) { setError(caught instanceof Error ? caught.message : "音声を再生できませんでした。"); }
    finally { setAudioLoading(false); }
  }

  return (
    <main>
      <header className="hero">
        <div className="brand"><Aperture complete={Boolean(projection)} /><span>シ ボ リ</span></div>
        <p className="eyebrow">FOCUS PORTFOLIO MANAGER</p>
        <h1>あなたの集中を、<br /><em>集中に値するもの</em>だけに。</h1>
        <p className="lead">教材を、移動中に聴く講義と、机で解くたった一問へ。選択肢を減らし、深く考える時間を守ります。</p>
      </header>

      <section>
        <SectionTitle number="00">あなたのこと</SectionTitle>
        <form className="context-grid" onSubmit={saveContext}>
          <label><span>WHAT YOU DO</span>何をしている人？<input required value={context.role} onChange={(e) => setContext({ ...context, role: e.target.value })} placeholder="エンジニア兼PM" /></label>
          <label><span>WHAT TO LEARN</span>何を学びたい？<input required value={context.goal} onChange={(e) => setContext({ ...context, goal: e.target.value })} placeholder="統計を学びたい" /></label>
          <label><span>WHY NOW</span>なぜ？<input required value={context.why} onChange={(e) => setContext({ ...context, why: e.target.value })} placeholder="A/Bテストを設計したい" /></label>
          <button className="text-button" type="submit">{contextSaved ? "✓ コンテキスト保存済み" : "この内容を覚える →"}</button>
        </form>
      </section>

      <section>
        <SectionTitle number="01">教材を入れる</SectionTitle>
        <div className="material-card">
          <div className="material-actions"><span>TEXT INTAKE</span><button type="button" onClick={() => setMaterial(sampleMaterial)}>サンプル教材を入れる</button></div>
          <textarea value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="ここに教材テキストを貼り付けてください。段落を残すと、より正確に仕分けできます。" />
          <div className="intake-note"><span>PDF・画像は本番版で対応予定</span><span>{material.length.toLocaleString()}文字</span></div>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="shiboru-button" onClick={project} disabled={loading}><Aperture active={loading} />{loading ? "集中の配分を考えています…" : projection ? "もう一度、絞る" : "この教材を、絞る"}</button>
      </section>

      <section className={!projection ? "muted-section" : ""}>
        <SectionTitle number="02">選択 — 仕分け結果</SectionTitle>
        {!projection ? <p className="empty-state">教材を絞ると、段落ごとの集中コストがここに現れます。</p> : <>
          {projection.source === "demo" && <p className="demo-notice">デモモード：OPENAI_API_KEYを設定するとGPT-5.6で仕分けます。</p>}
          <div className="segments">{projection.segments.map((segment, index) => <article className={`segment ${segment.mode}`} key={`${segment.text}-${index}`}>
            <div className="segment-index">{String(index + 1).padStart(2, "0")}</div>
            <div><span className="mode-tag">{segment.mode === "ear" ? "耳 / LISTEN" : "机 / FOCUS"}</span><h3>{segment.text}</h3><p>{segment.reason}</p></div>
            <button onClick={() => reportGap(segment)}>わからなかった</button>
          </article>)}</div>
        </>}
      </section>

      <section className={!projection ? "muted-section" : ""}>
        <SectionTitle number="03">今日の配分</SectionTitle>
        {!projection ? <p className="empty-state">今日は「聴く」と「一問」だけ。仕分け後に配ります。</p> : <div className="allocation">
          <article className="ear-card"><span className="card-label">EAR · すきま時間</span><h3>今日の3分講義</h3><p className="script">{projection.earScript}</p><div className="audio-row"><button onClick={playLecture} disabled={audioLoading}>{audioLoading ? "生成中…" : "▶ 講義を再生"}</button><span>AIが生成した音声です</span></div>{audioUrl && <audio ref={audioRef} src={audioUrl} controls />}</article>
          <article className="desk-card"><span className="card-label">DESK · 机の時間</span><h3>今日は、この1問。</h3><p className="problem">{projection.deskTask.problem}</p><div className="why"><span>WHY THIS ONE</span>{projection.deskTask.why}</div></article>
        </div>}
        <p className="rss-note">本番版では耳パートをあなた専用のポッドキャストフィードへ配信します。</p>
      </section>

      <section>
        <SectionTitle number="04">抜けマップ</SectionTitle>
        {gaps.filter((gap) => !gap.resolved).length === 0 ? <p className="empty-state">まだ抜けは見つかっていません。「わからなかった」が次の講義を賢くします。</p> : <div className="gap-list">{gaps.filter((gap) => !gap.resolved).map((gap) => <article key={gap.id}><span>{gap.source === "user_reported" ? "あなたから" : "GPT-5.6が検出"}</span><div><h3>{gap.topic}</h3><p>{gap.reason}</p></div><button onClick={() => resolveGap(gap.id)}>理解した ✓</button></article>)}</div>}
        {gaps.some((gap) => !gap.resolved) && <p className="loop-note">↻ もう一度「絞る」と、この抜けの補講が講義の冒頭に入ります。</p>}
      </section>
      <footer><Aperture /><p>SHIBORI<br /><span>Focus on what deserves focus.</span></p></footer>
    </main>
  );
}

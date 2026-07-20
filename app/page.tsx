"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import {
  applyCheckResult,
  chooseFocus,
  completeReinforcement,
  createLearningState,
  deferGap,
  resumeLearning,
  setLearningPlan,
} from "@/lib/learning";
import { sampleMaterial } from "@/lib/shibori";
import type {
  LearningPlanProposal,
  LearningState,
  Projection,
  UnderstandingCheckResult,
} from "@/lib/types";

const storageKey = "shibori-learning-state-v2";

function Aperture({ active, complete }: { active?: boolean; complete?: boolean }) {
  return <svg className={`aperture ${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`} viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="1.5" />
    {[0, 60, 120, 180, 240, 300].map((rotation) => <path key={rotation} d="M32 7 C44 11 50 19 50 31 L33 34 L21 20 Z" transform={`rotate(${rotation} 32 32)`} fill="currentColor" opacity=".82" />)}
    <circle cx="32" cy="32" r={complete ? 3 : 9} fill="var(--paper)" className="aperture-hole" />
  </svg>;
}

function SectionTitle({ number, children, note }: { number: string; children: React.ReactNode; note?: string }) {
  return <div className="section-title"><span>{number}</span><div><h2>{children}</h2>{note && <p>{note}</p>}</div></div>;
}

function statusLabel(status: string) {
  return { unknown: "関係を確認中", unconfirmed: "未確認", confirmed: "確認できた", gap: "補強候補" }[status] ?? status;
}

export default function Home() {
  const [purpose, setPurpose] = useState("");
  const [role, setRole] = useState("");
  const [why, setWhy] = useState("");
  const [target, setTarget] = useState("");
  const [material, setMaterial] = useState("");
  const [state, setState] = useState<LearningState | null>(null);
  const [plan, setPlan] = useState<LearningPlanProposal | null>(null);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<UnderstandingCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const serialized = localStorage.getItem(storageKey);
      if (!serialized) return;
      try {
        const saved = resumeLearning(serialized);
        setState(saved); setPurpose(saved.purpose.statement); setRole(saved.purpose.role); setWhy(saved.purpose.why); setTarget(saved.targetState ?? ""); setRestored(true);
      } catch { localStorage.removeItem(storageKey); }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (state) localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  async function requestPlan(nextState: LearningState, clearCheck = true) {
    const response = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: nextState, material }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    const proposal = body as LearningPlanProposal;
    let planned = nextState;
    if (proposal.mode === "learning" && proposal.targetState) planned = setLearningPlan(nextState, proposal.targetState, proposal.path);
    planned = chooseFocus(planned, proposal.focus);
    setState(planned); setPlan(proposal); setRestored(false);
    if (clearCheck) { setResult(null); setAnswer(""); }
    return planned;
  }

  async function projectMaterial(nextState: LearningState) {
    if (material.trim().length < 30) { setProjection(null); return; }
    const context = { role: nextState.purpose.role, goal: nextState.targetState ?? nextState.purpose.statement, why: nextState.purpose.why, updatedAt: new Date().toISOString() };
    const gaps = nextState.gaps.filter((gap) => gap.status !== "resolved").map((gap) => ({ id: gap.id, topic: gap.topic, reason: gap.reason, source: "user_reported" as const, resolved: false }));
    const response = await fetch("/api/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context, material, gaps }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setProjection(body);
  }

  async function begin(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      let next = createLearningState({ purpose: purpose.trim(), role: role.trim(), why: why.trim() });
      if (target.trim()) next = { ...next, phase: "learning", targetState: target.trim() };
      next = await requestPlan(next);
      await projectMaterial(next);
      requestAnimationFrame(() => document.querySelector("#path")?.scrollIntoView({ behavior: "smooth" }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "学びの入口を作れませんでした。"); }
    finally { setLoading(false); }
  }

  async function replan(nextState: LearningState = state!) {
    if (!nextState) return;
    setLoading(true); setError("");
    try { const planned = await requestPlan(nextState); await projectMaterial(planned); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "集中先を更新できませんでした。"); }
    finally { setLoading(false); }
  }

  async function establishTarget() {
    if (!state || !target.trim()) { setError("到達状態を「〜できる」の形で入力してください。"); return; }
    await replan({ ...state, phase: "learning", targetState: target.trim(), focus: null, updatedAt: new Date().toISOString() });
  }

  async function check() {
    if (!state || !plan || !answer.trim()) { setError("考えたことを、途中まででも書いてください。"); return; }
    setChecking(true); setError("");
    try {
      const response = await fetch("/api/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, prompt: plan.check.prompt, answer }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const checked = body as UnderstandingCheckResult;
      setResult(checked);
      if (state.phase === "learning") {
        const updated = applyCheckResult(state, checked);
        await requestPlan(updated, false);
        await projectMaterial(updated);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "理解状態を確認できませんでした。"); }
    finally { setChecking(false); }
  }

  function selectAnotherFocus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state) return;
    const data = new FormData(event.currentTarget);
    const title = String(data.get("focus") ?? "").trim();
    if (!title) return;
    setState(chooseFocus(state, { id: crypto.randomUUID(), kind: "learn", title, reason: "学習者が今取り組むと選んだ集中先です。", nodeId: null }));
  }

  async function playLecture() {
    if (!projection) return;
    if (audioUrl) { await audioRef.current?.play(); return; }
    setAudioLoading(true);
    try {
      const response = await fetch("/api/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script: projection.earScript }) });
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob()); setAudioUrl(url); requestAnimationFrame(() => audioRef.current?.play());
    } catch (caught) { setError(caught instanceof Error ? caught.message : "音声を再生できませんでした。"); }
    finally { setAudioLoading(false); }
  }

  const openGaps = state?.gaps.filter((gap) => gap.status !== "resolved") ?? [];

  return <main>
    <header className="hero">
      <div className="brand"><Aperture complete={Boolean(state?.focus)} /><span>シ ボ リ</span></div>
      {restored && <a className="resume-chip" href="#focus" onClick={() => void replan()}>前回の現在地から再開 →</a>}
      <p className="eyebrow">FOCUS PORTFOLIO FOR LEARNING</p>
      <h1>学びたいを、<br /><em>次のひとつ</em>に絞る。</h1>
      <p className="lead">興味から始めても、目標から始めてもいい。Shiboriは、到達状態・学習経路・理解状態をつなぎ、いま集中する一つを提案します。</p>
    </header>

    <section>
      <SectionTitle number="00" note="実用性や期限がなくても、知りたい気持ちは十分な出発点です。">学習目的</SectionTitle>
      <form className="purpose-form" onSubmit={begin}>
        <label className="wide"><span>LEARNING PURPOSE *</span>いま、何を学びたい？<input required value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="統計をもっと知りたい" /></label>
        <label><span>YOUR ACTIVITY</span>ふだん何をしている？<input value={role} onChange={(e) => setRole(e.target.value)} placeholder="エンジニア兼PM" /></label>
        <label><span>WHY / CURIOSITY</span>なぜ気になっている？<input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="純粋に面白そう、でも大丈夫" /></label>
        <label className="wide"><span>OPTIONAL CAN</span>できるようになりたいことがあれば<input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="A/Bテストの結果を根拠つきで判断できる（あとで決めてもOK）" /></label>
        <details className="material-disclosure"><summary>手元の教材も使う（任意）</summary><div className="material-actions"><button type="button" onClick={() => setMaterial(sampleMaterial)}>サンプル教材を入れる</button><span>{material.length.toLocaleString()}文字</span></div><textarea value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="教材テキストを貼り付けると、集中先に合わせて耳と机へ再編集します。" /></details>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="shiboru-button" disabled={loading}><Aperture active={loading} />{loading ? "学びの現在地を見ています…" : state ? "学びを組み直す" : "次のひとつを、絞る"}</button>
      </form>
    </section>

    <section id="path" className={!state ? "muted-section" : ""}>
      <SectionTitle number="01" note="一本道と決めつけず、分からない関係は分からないまま示します。">学習経路と現在地</SectionTitle>
      {!state ? <p className="empty-state">学習目的を入れると、探索または到達状態への経路が現れます。</p> : state.phase === "exploring" ? <div className="explore-state"><span>EXPLORING</span><h3>いまは探索中</h3><p>まず一度学んでみて、何を「できる」にしたいか見つけられます。到達状態を今決める必要はありません。</p><div className="target-later"><input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="見えてきたCanをここに置く" /><button onClick={establishTarget}>この到達状態で経路をつくる</button></div></div> : <>
        <div className="target-state"><span>CAN / 到達状態</span><strong>{state.targetState}</strong></div>
        <div className="path-list">{state.path.map((node, index) => <article key={node.id} className={`${node.status} ${node.id === state.currentNodeId ? "current" : ""}`}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{node.title}</h3><p>{node.dependsOn.length ? `前提: ${node.dependsOn.map((id) => state.path.find((item) => item.id === id)?.title ?? id).join(" / ")}` : "前提なし、または未確認"}</p></div><em>{node.id === state.currentNodeId ? "現在地" : statusLabel(node.status)}</em></article>)}</div>
      </>}
    </section>

    <section id="focus" className={!state?.focus ? "muted-section" : ""}>
      <SectionTitle number="02" note="おすすめは一つ。ただし、決めるのはあなたです。">次の集中先</SectionTitle>
      {!state?.focus ? <p className="empty-state">現在地が分かると、次に集中する一つを提案します。</p> : <div className={`focus-card ${state.focus.kind}`}><span>{state.focus.kind === "explore" ? "探索のひとつ" : state.focus.kind === "reinforce" ? "おすすめの補強" : "次のひとつ"}</span><h3>{state.focus.title}</h3><p>{state.focus.reason}</p><button onClick={() => replan()}>別のおすすめを見る</button></div>}
      {state && <form className="other-focus" onSubmit={selectAnotherFocus}><label><span>OR CHOOSE YOURSELF</span>別の学びを選ぶ<input name="focus" placeholder="今はこれを学ぶ" /></label><button>この学びを選ぶ</button></form>}
    </section>

    {projection && <section>
      <SectionTitle number="03" note="教材は目的ではなく、いまの集中先に使う材料です。">集中先に合わせた教材</SectionTitle>
      {projection.source === "demo" && <p className="demo-notice">デモモードです。APIキー設定時はGPT-5.6が同じ流れで再編集します。</p>}
      <div className="allocation"><article className="ear-card"><span className="card-label">EAR · 移動中</span><h3>耳でつかむ</h3><p className="script">{projection.earScript}</p><div className="audio-row"><button onClick={playLecture} disabled={audioLoading}>{audioLoading ? "生成中…" : "▶ 講義を再生"}</button><span>AI生成音声</span></div>{audioUrl && <audio ref={audioRef} src={audioUrl} controls />}</article><article className="desk-card"><span className="card-label">DESK · 机の時間</span><h3>今日は、この1問。</h3><p className="problem">{projection.deskTask.problem}</p><div className="why"><span>WHY THIS ONE</span>{projection.deskTask.why}</div></article></div>
    </section>}

    <section className={!plan ? "muted-section" : ""}>
      <SectionTitle number={projection ? "04" : "03"} note="読んだ・聞いたではなく、いま何ができるかを確かめます。">理解確認</SectionTitle>
      {!plan ? <p className="empty-state">集中先を選ぶと、その一つだけを確かめる問いが現れます。</p> : <div className="check-card"><span>CHECK ONE THING</span><h3>{plan.check.prompt}</h3><p>{plan.check.reason}</p><textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="自分の言葉、計算、判断の理由などを書いてください。" /><button onClick={check} disabled={checking}>{checking ? "いまできることを見ています…" : "理解状態を確かめる"}</button>{result && <div className={`check-result ${result.outcome}`}><strong>{result.outcome === "confirmed" ? "ここは確認できました" : "できた部分を残して、抜けを一つ発見"}</strong><p>{result.summary}</p></div>}</div>}
    </section>

    <section>
      <SectionTitle number={projection ? "05" : "04"} note="理由と影響を見て、今補強するか、後にするか選べます。">抜けと補強</SectionTitle>
      {!openGaps.length ? <p className="empty-state">理解確認で不足が見つかると、元の学びへ戻る場所と一緒に記録します。</p> : <div className="gap-list">{openGaps.map((gap) => <article key={gap.id}><span>{gap.status === "deferred" ? "あとで補強" : "補強おすすめ"}</span><div><h3>{gap.topic}</h3><p>{gap.reason}</p><p><strong>影響:</strong> {gap.impact}</p></div><div className="gap-actions"><button onClick={() => setState(chooseFocus(state!, { id: `reinforce-${gap.id}`, kind: "reinforce", title: gap.topic, reason: `${gap.reason}。${gap.impact}`, nodeId: gap.returnNodeId }))}>今、補強する</button><button onClick={() => setState(deferGap(state!, gap.id))}>あとで</button><button onClick={() => setState(completeReinforcement(state!, gap.id))}>補強を終えて戻る</button></div></article>)}</div>}
    </section>
    <footer><Aperture /><p>SHIBORI<br /><span>Focus on what deserves focus.</span></p></footer>
  </main>;
}

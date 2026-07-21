"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { applyCheckResult, chooseFocus, completeReinforcement, createLearningState, deferGap, prioritizeOpenGaps, setLearningPlan } from "@/lib/learning";
import { addLearningPurpose, createPortfolio, getSelectedLearningState, resumePortfolio, selectLearningPurpose, updateLearningPurpose } from "@/lib/portfolio";
import { sampleMaterialEn } from "@/lib/shibori";
import type { LearningPlanProposal, LearningPortfolio, LearningState, Projection, UnderstandingCheckResult } from "@/lib/types";

const storageKey = "shibori-learning-portfolio-v4";
const legacyStorageKeys = ["shibori-learning-portfolio-v3", "shibori-learning-state-v2"];

function Aperture({ active, complete }: { active?: boolean; complete?: boolean }) {
  return <svg className={`aperture ${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`} viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="1.5" />
    {[0, 60, 120, 180, 240, 300].map((rotation) => <path key={rotation} d="M32 7 C44 11 50 19 50 31 L33 34 L21 20 Z" transform={`rotate(${rotation} 32 32)`} fill="currentColor" opacity=".82" />)}
    <circle cx="32" cy="32" r={complete ? 3 : 9} fill="var(--paper)" className="aperture-hole" />
  </svg>;
}

function SectionTitle({ number, children, note }: { number: string; children: React.ReactNode; note: string }) {
  return <div className="section-title"><span>{number}</span><div><h2>{children}</h2><p>{note}</p></div></div>;
}

export default function EnglishHome() {
  const [purpose, setPurpose] = useState("");
  const [role, setRole] = useState("");
  const [why, setWhy] = useState("");
  const [target, setTarget] = useState("");
  const [material, setMaterial] = useState("");
  const [portfolio, setPortfolio] = useState<LearningPortfolio | null>(null);
  const [plan, setPlan] = useState<LearningPlanProposal | null>(null);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<UnderstandingCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    document.documentElement.lang = "en";
    localStorage.setItem("shibori-dialog-language", "en");
    const frame = requestAnimationFrame(() => {
      const serialized = localStorage.getItem(storageKey) ?? legacyStorageKeys.map((key) => localStorage.getItem(key)).find(Boolean);
      if (!serialized) return;
      try { setPortfolio(resumePortfolio(serialized)); } catch { localStorage.removeItem(storageKey); }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => { if (portfolio) localStorage.setItem(storageKey, JSON.stringify(portfolio)); }, [portfolio]);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const state = portfolio ? getSelectedLearningState(portfolio) : null;
  const prioritizedGaps = state ? prioritizeOpenGaps(state) : null;

  function commit(next: LearningState, add = false) {
    setPortfolio((current) => {
      if (!current) return createPortfolio(next);
      if (add) return selectLearningPurpose(addLearningPurpose(current, next), next.purpose.id);
      return updateLearningPurpose(current, next);
    });
  }

  async function requestPlan(next: LearningState, add = false) {
    const response = await fetch("/api/plan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: next, material, language: "en" }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    const proposal = body as LearningPlanProposal;
    let planned = next;
    if (proposal.mode === "learning" && proposal.targetState) planned = setLearningPlan(next, proposal.targetState, proposal.path);
    planned = chooseFocus(planned, { ...proposal.focus, source: body.source === "demo" ? "demo" : "personalized" });
    commit(planned, add); setPlan(proposal); setResult(null); setAnswer("");
    return planned;
  }

  async function project(next: LearningState) {
    if (material.trim().length < 30) { setProjection(null); return; }
    const response = await fetch("/api/project", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: { role: next.purpose.role, goal: next.targetState ?? next.purpose.statement, why: next.purpose.why, updatedAt: new Date().toISOString() },
        material, gaps: [], focusResource: { minutes: 15, attention: "light" },
        learningPosition: { targetState: next.targetState, current: next.path.find((node) => node.id === next.currentNodeId)?.title ?? "Exploring", focus: next.focus?.title ?? "Not selected" },
        language: "en",
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setProjection(body);
  }

  async function begin(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      let next = createLearningState({ purpose: purpose.trim(), role: role.trim(), why: why.trim() });
      if (target.trim()) next = { ...next, phase: "learning", targetState: target.trim() };
      next = await requestPlan(next, Boolean(portfolio));
      await project(next);
      setPurpose(""); setRole(""); setWhy(""); setTarget("");
      requestAnimationFrame(() => document.querySelector("#focus")?.scrollIntoView({ behavior: "smooth" }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't create your learning path."); }
    finally { setLoading(false); }
  }

  async function replan() {
    if (!state) return;
    setLoading(true); setError("");
    try { const next = await requestPlan(state); await project(next); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't update your focus."); }
    finally { setLoading(false); }
  }

  async function check() {
    if (!state || !plan || !answer.trim()) { setError("Write what you think, even if it is incomplete."); return; }
    setChecking(true); setError("");
    try {
      const response = await fetch("/api/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, prompt: plan.check.prompt, answer, language: "en" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const checked = body as UnderstandingCheckResult;
      setResult(checked);
      if (state.phase === "learning") commit(applyCheckResult(state, checked));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't check your understanding."); }
    finally { setChecking(false); }
  }

  async function playLecture() {
    if (!projection?.earScript) return;
    if (audioUrl) { await audioRef.current?.play(); return; }
    setAudioLoading(true); setError("");
    try {
      const response = await fetch("/api/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script: projection.earScript, language: "en" }) });
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob()); setAudioUrl(url); requestAnimationFrame(() => audioRef.current?.play());
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't play the lecture."); }
    finally { setAudioLoading(false); }
  }

  return <main>
    <header className="hero">
      <nav className="language-switch" aria-label="Language"><strong aria-current="page">EN</strong><Link href="/ja" lang="ja">日本語</Link></nav>
      <div className="brand"><Aperture complete={Boolean(state?.focus)} /><span>S H I B O R I</span></div>
      <p className="eyebrow">FOCUS PORTFOLIO FOR LEARNING</p>
      <h1>Turn everything you want to learn<br />into <em>one thing worth your focus.</em></h1>
      <p className="lead">Start with curiosity or a clear goal. Shibori connects your target, learning path, and current understanding—then recommends one next focus.</p>
    </header>

    <section>
      <SectionTitle number="00" note="Keep multiple learning purposes without mixing them. You make the final choice.">Your learning portfolio</SectionTitle>
      {portfolio && <div className="portfolio-panel"><div className="purpose-tabs">{portfolio.purposes.map((item) => <button type="button" key={item.purpose.id} className={item.purpose.id === portfolio.selectedPurposeId ? "selected" : ""} onClick={() => { setPortfolio(selectLearningPurpose(portfolio, item.purpose.id)); setPlan(null); setProjection(null); }}><span>{item.purpose.status.toUpperCase()}</span><strong>{item.purpose.statement}</strong><small>{item.targetState ?? "Can to be discovered"}</small></button>)}</div></div>}
      <h3 className="add-purpose-title">{portfolio ? "Add another learning purpose" : "Your first learning purpose"}</h3>
      <form className="purpose-form" onSubmit={begin}>
        <label className="wide"><span>LEARNING PURPOSE *</span>What do you want to learn?<input required value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="I want to understand statistics" /></label>
        <label><span>YOUR ACTIVITY</span>What do you do?<input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Engineer and product manager" /></label>
        <label><span>WHY / CURIOSITY</span>Why does it matter to you?<input value={why} onChange={(event) => setWhy(event.target.value)} placeholder="I want to design trustworthy A/B tests" /></label>
        <label className="wide"><span>OPTIONAL CAN</span>What would you like to be able to do?<input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="I can make an evidence-based decision from an A/B test" /></label>
        <details className="material-disclosure"><summary>Use material you already have (optional)</summary><div className="material-actions"><button type="button" onClick={() => setMaterial(sampleMaterialEn)}>Load sample material</button><span>{material.length.toLocaleString("en")} characters</span></div><textarea value={material} onChange={(event) => setMaterial(event.target.value)} placeholder="Paste learning material. Shibori will reshape it around your available focus." /></details>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="shiboru-button" disabled={loading}><Aperture active={loading} />{loading ? "Finding your current position…" : portfolio ? "Add this purpose" : "Shibori — choose my one next focus"}</button>
      </form>
    </section>

    <section className={!state ? "muted-section" : ""}>
      <SectionTitle number="01" note="See the destination, dependencies, and the position supported by your checks.">Your path and current position</SectionTitle>
      {!state ? <p className="empty-state">Add a learning purpose to reveal an exploration or a path toward your Can.</p> : state.phase === "exploring" ? <div className="explore-state"><span>EXPLORING</span><h3>Your Can can come later.</h3><p>Try one meaningful example first. Use the understanding check to notice what you want to be able to explain or do.</p></div> : <><div className="target-state"><span>CAN / TARGET STATE</span><strong>{state.targetState}</strong></div><div className="path-list">{state.path.map((node, index) => <article key={node.id} className={`${node.status} ${node.id === state.currentNodeId ? "current" : ""}`}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{node.title}</h3><p>{node.dependsOn.length ? `Depends on: ${node.dependsOn.map((id) => state.path.find((item) => item.id === id)?.title ?? id).join(" / ")}` : "No confirmed prerequisite"}</p></div><em>{node.id === state.currentNodeId ? "CURRENT" : ({ unknown: "UNKNOWN", unconfirmed: "UNCHECKED", confirmed: "CONFIRMED", gap: "GAP" } as const)[node.status]}</em></article>)}</div></>}
    </section>

    <section id="focus" className={!state?.focus ? "muted-section" : ""}>
      <SectionTitle number="02" note="One recommendation, with its reason. The decision remains yours.">Your next focus</SectionTitle>
      {!state?.focus ? <p className="empty-state">Add a learning purpose to reveal one next focus.</p> : <div className={`focus-card ${state.focus.kind}`}><span>{state.focus.kind === "explore" ? "ONE EXPLORATION" : "ONE NEXT FOCUS"} · {state.focus.source === "demo" ? "DEMO" : "GPT-5.6"}</span><h3>{state.focus.title}</h3><p>{state.focus.reason}</p><button type="button" onClick={() => void replan()} disabled={loading}>Reconsider from my current state</button></div>}
    </section>

    {projection && <section>
      <SectionTitle number="03" note="The material changes shape around the focus you can afford now.">Material shaped to your focus</SectionTitle>
      {projection.source === "demo" && <p className="demo-notice">Demo mode. With an API key, GPT-5.6 makes the same decisions from your own material.</p>}
      <div className="material-map"><h3>Material map</h3>{projection.segments.map((segment, index) => <article key={`${segment.text}-${index}`} className={segment.position}><span>{({ now: "USE NOW", later: "LATER", unrelated: "UNRELATED", unknown: "UNKNOWN" } as const)[segment.position]}</span><div><strong>{segment.text}</strong><small>{segment.reason}</small></div><em>{segment.attention === "light" ? "LIGHT" : segment.attention === "deep" ? "DEEP" : "UNDECIDED"}</em></article>)}</div>
      {projection.earScript && <div className="allocation single"><article className="ear-card"><span className="card-label">LIGHT FOCUS</span><h3>Grasp it by listening</h3><p className="script">{projection.earScript}</p><div className="audio-row"><button type="button" onClick={playLecture} disabled={audioLoading}>{audioLoading ? "Generating…" : "▶ Play the lecture"}</button><span>Listening alone does not mark this as understood.</span></div>{audioUrl && <audio ref={audioRef} src={audioUrl} controls />}</article></div>}
      {projection.deskTask && <div className="allocation single"><article className="desk-card"><span className="card-label">DEEP FOCUS</span><h3>Just this one problem today.</h3><p className="problem">{projection.deskTask.problem}</p><div className="why"><span>WHY THIS ONE</span>{projection.deskTask.why}</div></article></div>}
    </section>}

    <section className={!plan ? "muted-section" : ""}>
      <SectionTitle number={projection ? "04" : "03"} note="Check what you can do now—not whether you merely read or listened.">Check your understanding</SectionTitle>
      {!plan ? <p className="empty-state">Choose a focus to receive one question.</p> : <div className="check-card"><span>CHECK ONE THING</span><h3>{plan.check.prompt}</h3><p>{plan.check.reason}</p><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Explain in your own words, show a calculation, or give your reason." /><button type="button" onClick={check} disabled={checking}>{checking ? "Checking what you can do…" : "Check my current understanding"}</button>{result && <div className={`check-result ${result.outcome}`}><strong>{result.outcome === "confirmed" ? "Confirmed here" : "One gap found—without erasing what you did"}</strong><p>{result.summary}</p><small>Next: {result.nextAction}</small></div>}</div>}
    </section>

    <section className={!prioritizedGaps ? "muted-section" : ""}>
      <SectionTitle number={projection ? "05" : "04"} note="See why a gap matters, then choose whether to reinforce it now or later.">Gaps and reinforcement</SectionTitle>
      {!prioritizedGaps ? <p className="empty-state">When a check reveals a gap, Shibori keeps the return point without erasing what you already demonstrated.</p> : <div className="gap-list"><article><span>ONE GAP WITH THE MOST IMPACT</span><div><h3>{prioritizedGaps.gap.topic}</h3><p>{prioritizedGaps.reason}</p><small>{prioritizedGaps.gap.impact}</small></div><div className="gap-actions"><button type="button" onClick={() => commit(chooseFocus(state!, { id: `reinforce-${prioritizedGaps.gap.id}`, kind: "reinforce", title: prioritizedGaps.gap.topic, reason: `${prioritizedGaps.gap.reason}. ${prioritizedGaps.gap.impact}`, nodeId: prioritizedGaps.gap.returnNodeId }))}>Reinforce now</button><button type="button" onClick={() => commit(deferGap(state!, prioritizedGaps.gap.id))}>Later</button><button type="button" onClick={() => commit(completeReinforcement(state!, prioritizedGaps.gap.id))}>Finish and return</button></div></article>{prioritizedGaps.remaining.length > 0 && <details className="remaining-gaps"><summary>{prioritizedGaps.remaining.length} more gaps kept for later</summary>{prioritizedGaps.remaining.map((gap) => <p key={gap.id}><strong>{gap.topic}</strong> — {gap.impact}</p>)}</details>}</div>}
    </section>
  </main>;
}

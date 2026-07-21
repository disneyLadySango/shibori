"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import {
  applyCheckResult,
  challengeUnderstanding,
  chooseFocus,
  completeReinforcement,
  createLearningState,
  deferGap,
  explainFocus,
  learningDataPolicy,
  recordDependencyCorrection,
  recordPositionCorrection,
  setLearningPlan,
} from "@/lib/learning";
import {
  addLearningPurpose,
  createPortfolio,
  getSelectedLearningState,
  resumePortfolio,
  recordAllocation,
  reflectOnAllocation,
  selectLearningPurpose,
  setPurposeStatus,
  setPurposeRecommendation,
  updatePurposeContext,
  updateLearningPurpose,
} from "@/lib/portfolio";
import { sampleMaterial } from "@/lib/shibori";
import type {
  LearningPortfolio,
  LearningPlanProposal,
  LearningState,
  Projection,
  PurposeRecommendation,
  UnderstandingCheckResult,
} from "@/lib/types";

const storageKey = "shibori-learning-portfolio-v4";
const legacyStorageKeys = ["shibori-learning-portfolio-v3", "shibori-learning-state-v2"];

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

function purposeStatusLabel(status: string) {
  return { active: "進行中", paused: "休止", achieved: "達成", stopped: "取止め" }[status] ?? status;
}

export default function Home() {
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
  const [availableFocus, setAvailableFocus] = useState("");
  const [materialMinutes, setMaterialMinutes] = useState(15);
  const [materialAttention, setMaterialAttention] = useState<"light" | "deep">("light");
  const [prioritizing, setPrioritizing] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [challengeReason, setChallengeReason] = useState("");
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const serialized = localStorage.getItem(storageKey) ?? legacyStorageKeys.map((key) => localStorage.getItem(key)).find(Boolean);
      if (!serialized) return;
      try {
        setPortfolio(resumePortfolio(serialized)); setRestored(true);
      } catch { localStorage.removeItem(storageKey); legacyStorageKeys.forEach((key) => localStorage.removeItem(key)); }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (portfolio) localStorage.setItem(storageKey, JSON.stringify(portfolio));
  }, [portfolio]);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const state = portfolio ? getSelectedLearningState(portfolio) : null;

  function commitLearningState(nextState: LearningState, add = false) {
    setPortfolio((current) => {
      if (!current) return createPortfolio(nextState);
      if (add) return selectLearningPurpose(addLearningPurpose(current, nextState), nextState.purpose.id);
      return updateLearningPurpose(current, nextState);
    });
  }

  async function requestPlan(nextState: LearningState, clearCheck = true, add = false) {
    const response = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: nextState, material }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    const proposal = body as LearningPlanProposal;
    let planned = nextState;
    if (proposal.mode === "learning" && proposal.targetState) planned = setLearningPlan(nextState, proposal.targetState, proposal.path);
    planned = chooseFocus(planned, { ...proposal.focus, source: body.source === "demo" ? "demo" : "personalized" });
    commitLearningState(planned, add); setPlan(proposal); setRestored(false);
    if (clearCheck) { setResult(null); setAnswer(""); }
    return planned;
  }

  async function projectMaterial(nextState: LearningState) {
    if (material.trim().length < 30) { setProjection(null); return; }
    const context = { role: nextState.purpose.role, goal: nextState.targetState ?? nextState.purpose.statement, why: nextState.purpose.why, updatedAt: new Date().toISOString() };
    const gaps = nextState.gaps.filter((gap) => gap.status !== "resolved").map((gap) => ({ id: gap.id, topic: gap.topic, reason: gap.reason, source: "user_reported" as const, resolved: false }));
    const current = nextState.path.find((node) => node.id === nextState.currentNodeId)?.title ?? "探索中";
    const response = await fetch("/api/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      context, material, gaps,
      focusResource: { minutes: materialMinutes, attention: materialAttention },
      learningPosition: { targetState: nextState.targetState, current, focus: nextState.focus?.title ?? "未選択" },
    }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setProjection(body);
  }

  async function begin(event: FormEvent) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      let next = createLearningState({ purpose: purpose.trim(), role: role.trim(), why: why.trim() });
      if (target.trim()) next = { ...next, phase: "learning", targetState: target.trim() };
      next = await requestPlan(next, true, Boolean(portfolio));
      await projectMaterial(next);
      setPurpose(""); setRole(""); setWhy(""); setTarget("");
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
      const pendingChallenge = state.checkChallenges.findLast((challenge) => challenge.status === "pending");
      const checked = { ...(body as UnderstandingCheckResult), nodeId: pendingChallenge?.nodeId ?? (body as UnderstandingCheckResult).nodeId };
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
    commitLearningState(chooseFocus(state, { id: crypto.randomUUID(), kind: "learn", title, reason: "学習者が今取り組むと選んだ集中先です。", nodeId: null, source: "learner" }));
  }

  function correctPosition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state || !correctionReason.trim()) return;
    const data = new FormData(event.currentTarget);
    const nodeId = String(data.get("nodeId"));
    const corrected = data.get("kind") === "dependency"
      ? recordDependencyCorrection(state, { nodeId, dependsOn: String(data.get("dependsOn") ?? "").split(",").filter(Boolean), reason: correctionReason })
      : recordPositionCorrection(state, { nodeId, reason: correctionReason });
    commitLearningState(corrected); setCorrectionReason(""); setResult(null); setAnswer("");
  }

  function challengeCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state?.lastCheck || !challengeReason.trim()) return;
    const challenged = challengeUnderstanding(state, challengeReason);
    const node = state.path.find((item) => item.id === state.lastCheck?.nodeId);
    commitLearningState(challenged); setChallengeReason(""); setResult(null); setAnswer("");
    setPlan((current) => current ? { ...current, check: {
      nodeId: state.lastCheck!.nodeId,
      prompt: `「${node?.title ?? "前回の集中先"}」について、前回の判定を見直せるよう別の説明・計算・具体例で示してください。`,
      reason: "元の確認結果を残したまま、追加の理解確認で再評価するためです。",
    } } : current);
  }

  function choosePurpose(purposeId: string) {
    if (!portfolio) return;
    setPortfolio(selectLearningPurpose(portfolio, purposeId));
    setPlan(null); setProjection(null); setResult(null); setAnswer(""); setError("");
  }

  async function recommendPurpose(candidate: LearningPortfolio | null = portfolio) {
    if (!candidate || !candidate.purposes.some((item) => item.purpose.status === "active")) return;
    setPrioritizing(true); setError("");
    try {
      const response = await fetch("/api/prioritize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ portfolio: candidate, availableFocus }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setPortfolio((current) => current ? setPurposeRecommendation(current, body as PurposeRecommendation) : current);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "学習目的をおすすめできませんでした。"); }
    finally { setPrioritizing(false); }
  }

  async function changePurposeContext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!portfolio || !state) return;
    const data = new FormData(event.currentTarget);
    const next = updatePurposeContext(portfolio, state.purpose.id, {
      deadline: String(data.get("deadline") || "") || null,
      importance: String(data.get("importance") || "normal") as "low" | "normal" | "high",
      usageContext: String(data.get("usageContext") || "").trim(),
    });
    setPortfolio(next);
    await recommendPurpose(next);
  }

  function changePurposeStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!portfolio || !state) return;
    const data = new FormData(event.currentTarget);
    const status = String(data.get("status")) as LearningState["purpose"]["status"];
    const reason = String(data.get("statusReason") || "").trim();
    if (!reason) { setError("休止・再開・終了の理由を入力してください。"); return; }
    setPortfolio(setPurposeStatus(portfolio, state.purpose.id, status, reason));
    setPlan(null); setProjection(null); setResult(null); setError("");
  }

  function saveAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!portfolio || !state) return;
    const data = new FormData(event.currentTarget);
    const minutes = Number(data.get("minutes"));
    if (!Number.isInteger(minutes) || minutes <= 0) { setError("使った時間を1分以上で入力してください。"); return; }
    setPortfolio(recordAllocation(portfolio, state.purpose.id, { depth: String(data.get("depth")) as "ear" | "desk" | "deep", minutes, note: String(data.get("allocationNote") || "").trim() }));
    event.currentTarget.reset(); setError("");
  }

  function saveReflection(judgment: "intentional" | "unintended") {
    if (!portfolio || !state) return;
    const reason = window.prompt(judgment === "intentional" ? "この偏りを意図した理由は？" : "意図しなかった偏りについて教えてください")?.trim();
    if (!reason) return;
    setPortfolio(reflectOnAllocation(portfolio, state.purpose.id, judgment, reason));
  }

  async function refitMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state) return;
    setLoading(true); setError(""); setAudioUrl("");
    try { await projectMaterial(state); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "教材を今回の集中資源へ合わせられませんでした。"); }
    finally { setLoading(false); }
  }

  async function playLecture() {
    if (!projection?.earScript) return;
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
  const latestContextChange = portfolio?.contextChanges.at(-1);
  const focusExplanation = state?.focus ? explainFocus(state) : null;
  const pendingChallenge = state?.checkChallenges.findLast((challenge) => challenge.status === "pending");

  return <main>
    <header className="hero">
      <div className="brand"><Aperture complete={Boolean(state?.focus)} /><span>シ ボ リ</span></div>
      {restored && <a className="resume-chip" href="#focus" onClick={() => void replan()}>前回の現在地から再開 →</a>}
      <p className="eyebrow">FOCUS PORTFOLIO FOR LEARNING</p>
      <h1>学びたいを、<br /><em>次のひとつ</em>に絞る。</h1>
      <p className="lead">興味から始めても、目標から始めてもいい。Shiboriは、到達状態・学習経路・理解状態をつなぎ、いま集中する一つを提案します。</p>
    </header>

    <section>
      <SectionTitle number="00" note="複数の学びを混ぜずに持ち、最終的にどれを選ぶかはあなたが決めます。">学習ポートフォリオ</SectionTitle>
      {portfolio && <div className="portfolio-panel">
        <div className="purpose-tabs">{portfolio.purposes.map((item) => <button type="button" key={item.purpose.id} className={`${item.purpose.id === portfolio.selectedPurposeId ? "selected" : ""} ${item.purpose.status}`} onClick={() => choosePurpose(item.purpose.id)}><span>{purposeStatusLabel(item.purpose.status)}{item.purpose.id === portfolio.selectedPurposeId ? " · 表示中" : ""}</span><strong>{item.purpose.statement}</strong><small>{item.targetState ?? "Canはこれから"}</small></button>)}</div>
        {state && <div className="purpose-management">
          <form onSubmit={changePurposeContext} className="purpose-context-form"><h3>状況を更新して、おすすめを見直す</h3><label><span>DEADLINE</span>期限<input name="deadline" type="date" defaultValue={state.purpose.deadline ?? ""} key={`${state.purpose.id}-deadline-${state.purpose.deadline}`} /></label><label><span>IMPORTANCE</span>いまの重要度<select name="importance" defaultValue={state.purpose.importance} key={`${state.purpose.id}-importance-${state.purpose.importance}`}><option value="low">低い</option><option value="normal">通常</option><option value="high">高い</option></select></label><label><span>USE CONTEXT</span>利用場面<input name="usageContext" defaultValue={state.purpose.usageContext} key={`${state.purpose.id}-usage-${state.purpose.usageContext}`} placeholder="例: 来週のA/Bテスト会議" /></label><button>保存して再評価</button></form>
          <form onSubmit={changePurposeStatus} className="purpose-status-form"><h3>続け方を変える</h3><label><span>STATUS</span>状態<select name="status" defaultValue={state.purpose.status} key={`${state.purpose.id}-status-${state.purpose.status}`}><option value="active">進行中</option><option value="paused">休止</option><option value="achieved">達成</option><option value="stopped">取止め</option></select></label><label><span>REASON</span>理由<input name="statusReason" defaultValue={state.purpose.statusReason} key={`${state.purpose.id}-reason-${state.purpose.statusReason}`} placeholder="後で戻る自分にも分かる理由" /></label><button>状態を記録</button></form>
        </div>}
        {portfolio.purposes.filter((item) => item.purpose.status === "active").length > 1 && <div className="portfolio-choice">
          <label><span>AVAILABLE FOCUS</span>今使える集中資源（任意）<input value={availableFocus} onChange={(event) => setAvailableFocus(event.target.value)} placeholder="例: 深い集中を30分 / 移動中に15分" /></label>
          <button type="button" onClick={() => void recommendPurpose()} disabled={prioritizing}>{prioritizing ? "目的間の配分を考えています…" : "次の学習目的を一つおすすめ"}</button>
        </div>}
        {portfolio.recommendation && <article className="purpose-recommendation"><span>GPT-5.6 RECOMMENDS ONE</span><h3>{portfolio.purposes.find((item) => item.purpose.id === portfolio.recommendation?.purposeId)?.purpose.statement}</h3><p>{portfolio.recommendation.reason}</p><small>判断に使ったこと: {portfolio.recommendation.basis.join(" / ")}</small>{portfolio.recommendationHistory.length > 1 && <details><summary>変更前のおすすめと比べる</summary><p>変更前: {portfolio.purposes.find((item) => item.purpose.id === portfolio.recommendationHistory.at(-2)?.purposeId)?.purpose.statement} — {portfolio.recommendationHistory.at(-2)?.reason}</p><p>変更後: {portfolio.recommendation.reason}</p>{latestContextChange && <p>変わった状況: 期限 {latestContextChange.before.deadline || "未設定"} → {latestContextChange.after.deadline || "未設定"} / 重要度 {latestContextChange.before.importance} → {latestContextChange.after.importance} / 利用場面 {latestContextChange.before.usageContext || "未設定"} → {latestContextChange.after.usageContext || "未設定"}</p>}</details>}<div><button type="button" onClick={() => choosePurpose(portfolio.recommendation!.purposeId)}>このおすすめを選ぶ</button><em>別の目的を選んでも、失敗にはなりません。</em></div></article>}
        <details className="data-transparency"><summary>学習状態の扱いを確認する</summary><div><article><span>RECORD</span><strong>このブラウザに保存</strong><p>{learningDataPolicy.recorded}を保存します。</p></article><article><span>USE</span><strong>次の一つを判断</strong><p>{learningDataPolicy.use}。</p></article><article><span>SHARE</span><strong>共有範囲</strong><p>{learningDataPolicy.sharing}。</p></article></div></details>
      </div>}
      <h3 className="add-purpose-title">{portfolio ? "学習目的をもう一つ加える" : "最初の学習目的"}</h3>
      <form className="purpose-form" onSubmit={begin}>
        <label className="wide"><span>LEARNING PURPOSE *</span>いま、何を学びたい？<input required value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="統計をもっと知りたい" /></label>
        <label><span>YOUR ACTIVITY</span>ふだん何をしている？<input value={role} onChange={(e) => setRole(e.target.value)} placeholder="エンジニア兼PM" /></label>
        <label><span>WHY / CURIOSITY</span>なぜ気になっている？<input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="純粋に面白そう、でも大丈夫" /></label>
        <label className="wide"><span>OPTIONAL CAN</span>できるようになりたいことがあれば<input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="A/Bテストの結果を根拠つきで判断できる（あとで決めてもOK）" /></label>
        <details className="material-disclosure"><summary>手元の教材も使う（任意）</summary><div className="material-actions"><button type="button" onClick={() => setMaterial(sampleMaterial)}>サンプル教材を入れる</button><span>{material.length.toLocaleString()}文字</span></div><textarea value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="教材テキストを貼り付けると、集中先に合わせて耳と机へ再編集します。" /></details>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="shiboru-button" disabled={loading}><Aperture active={loading} />{loading ? "学びの現在地を見ています…" : portfolio ? "この学習目的を加える" : "次のひとつを、絞る"}</button>
      </form>
    </section>

    <section id="path" className={!state ? "muted-section" : ""}>
      <SectionTitle number="01" note="一本道と決めつけず、分からない関係は分からないまま示します。">学習経路と現在地</SectionTitle>
      {!state ? <p className="empty-state">学習目的を入れると、探索または到達状態への経路が現れます。</p> : state.phase === "exploring" ? <div className="explore-state"><span>EXPLORING</span><h3>いまは探索中</h3><p>まず一度学んでみて、何を「できる」にしたいか見つけられます。到達状態を今決める必要はありません。</p><div className="target-later"><input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="見えてきたCanをここに置く" /><button onClick={establishTarget}>この到達状態で経路をつくる</button></div></div> : <>
        <div className="target-state"><span>CAN / 到達状態</span><strong>{state.targetState}</strong></div>
        <div className="path-list">{state.path.map((node, index) => <article key={node.id} className={`${node.status} ${node.id === state.currentNodeId ? "current" : ""}`}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{node.title}</h3><p>{node.dependsOn.length ? `前提: ${node.dependsOn.map((id) => state.path.find((item) => item.id === id)?.title ?? id).join(" / ")}` : "前提なし、または未確認"}</p></div><em>{node.id === state.currentNodeId ? "現在地" : statusLabel(node.status)}</em></article>)}</div>
        <form className="correction-form" onSubmit={correctPosition}><h3>現在地や前提関係が違う？</h3><p>異議だけでは理解状態を変えません。訂正前の判断も履歴に残します。</p><label><span>対象</span><select name="nodeId" defaultValue={state.currentNodeId ?? state.path[0]?.id}>{state.path.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label><label><span>この前提へ訂正</span><select name="dependsOn"><option value="">前提なし</option>{state.path.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label><input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="違うと思う理由" /><div><button name="kind" value="position">現在地を訂正</button><button name="kind" value="dependency">前提関係を訂正</button></div>{state.positionCorrections.at(-1) && <small>前回の訂正: {state.positionCorrections.at(-1)?.reason}</small>}</form>
      </>}
    </section>

    <section id="focus" className={!state?.focus ? "muted-section" : ""}>
      <SectionTitle number="02" note="おすすめは一つ。ただし、決めるのはあなたです。">次の集中先</SectionTitle>
      {!state?.focus ? <p className="empty-state">現在地が分かると、次に集中する一つを提案します。</p> : <div className={`focus-card ${state.focus.kind}`}><span>{state.focus.kind === "explore" ? "探索のひとつ" : state.focus.kind === "reinforce" ? "おすすめの補強" : "次のひとつ"} · {state.focus.source === "learner" ? "あなたの選択" : state.focus.source === "demo" ? "固定デモ" : state.focus.source === "inferred" ? "確認結果からの推定" : "個別判断"}</span><h3>{state.focus.title}</h3><p>{state.focus.reason}</p>{focusExplanation && <details className="focus-basis"><summary>なぜ、この一つ？</summary>{focusExplanation.basis.map((basis) => <p key={basis.label}><strong>{basis.label}</strong><span>{basis.value}</span><em>{({ learner_input: "あなたの入力", confirmed: "確認結果", inferred: "推定", unknown: "判断できない" } as const)[basis.certainty]}</em></p>)}{focusExplanation.uncertainty.map((item) => <small key={item}>{item}</small>)}</details>}<button onClick={() => replan()}>別のおすすめを見る</button></div>}
      {state && <form className="other-focus" onSubmit={selectAnotherFocus}><label><span>OR CHOOSE YOURSELF</span>別の学びを選ぶ<input name="focus" placeholder="今はこれを学ぶ" /></label><button>この学びを選ぶ</button></form>}
    </section>

    {state && material.trim().length >= 30 && <section>
      <SectionTitle number="03" note="教材の順序ではなく、今回使える集中資源へ合わせて一つだけ選びます。">集中資源に合わせた教材</SectionTitle>
      <form className="focus-resource-form" onSubmit={refitMaterial}><label><span>MINUTES</span>今回使える時間<input type="number" min="1" max="480" value={materialMinutes} onChange={(event) => setMaterialMinutes(Number(event.target.value))} /></label><label><span>ATTENTION</span>使える注意の深さ<select value={materialAttention} onChange={(event) => setMaterialAttention(event.target.value as "light" | "deep")}><option value="light">軽い集中</option><option value="deep">深い集中</option></select></label><button disabled={loading}>{loading ? "合わせています…" : "この集中資源でもう一度絞る"}</button></form>
      {projection?.source === "demo" && <p className="demo-notice">デモモードです。APIキー設定時はGPT-5.6が同じ流れで再編集します。</p>}
      {projection && <><div className="material-map"><h3>教材の位置づけ</h3>{projection.segments.map((segment, index) => <article key={`${segment.text}-${index}`} className={segment.position}><span>{({ now: "今使う", later: "後で使う", unrelated: "関係しない", unknown: "判断できない" } as const)[segment.position]}</span><div><strong>{segment.text}</strong><small>{segment.reason}</small></div><em>{segment.attention === "light" ? "軽い集中" : segment.attention === "deep" ? "深い集中" : "未判断"}</em></article>)}</div>
      {projection.fit.status === "no_fit" ? <article className="no-fit-card"><span>NO FIT THIS TIME</span><h3>今回は、無理に選びません。</h3><p>{projection.fit.reason}</p><small>到達状態・現在地・理解状態は変更していません。</small></article> : <><article className="selected-material"><span>今回使う一つ</span><h3>{projection.selected?.text}</h3><p>{projection.fit.reason}</p></article>{projection.earScript && <div className="allocation single"><article className="ear-card"><span className="card-label">LIGHT · 軽い集中</span><h3>耳でつかむ</h3><p className="script">{projection.earScript}</p><div className="audio-row"><button onClick={playLecture} disabled={audioLoading}>{audioLoading ? "生成中…" : "▶ 講義を再生"}</button><span>聞いただけでは理解済みになりません</span></div>{audioUrl && <audio ref={audioRef} src={audioUrl} controls />}</article></div>}{projection.deskTask && <div className="allocation single"><article className="desk-card"><span className="card-label">DEEP · 深い集中</span><h3>今日は、この1問。</h3><p className="problem">{projection.deskTask.problem}</p><div className="why"><span>WHY THIS ONE</span>{projection.deskTask.why}</div></article></div>}</>}</>}
    </section>}

    <section className={!plan ? "muted-section" : ""}>
      <SectionTitle number={projection ? "04" : "03"} note="読んだ・聞いたではなく、いま何ができるかを確かめます。">理解確認</SectionTitle>
      {!plan ? <p className="empty-state">集中先を選ぶと、その一つだけを確かめる問いが現れます。</p> : <div className="check-card"><span>{pendingChallenge ? "RECHECK · 追加の理解確認" : "CHECK ONE THING"}</span><h3>{plan.check.prompt}</h3><p>{plan.check.reason}</p><textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="自分の言葉、計算、判断の理由などを書いてください。" /><button onClick={check} disabled={checking}>{checking ? "いまできることを見ています…" : pendingChallenge ? "追加の確認結果で再評価" : "理解状態を確かめる"}</button>{result && <div className={`check-result ${result.outcome}`}><strong>{result.outcome === "confirmed" ? "ここは確認できました" : "できた部分を残して、抜けを一つ発見"}</strong><p>{result.summary}</p></div>}{state?.lastCheck && !pendingChallenge && <form className="challenge-form" onSubmit={challengeCheck}><label><span>CHALLENGE</span>この判定に異議がある<input value={challengeReason} onChange={(event) => setChallengeReason(event.target.value)} placeholder="見直してほしい理由" /></label><button>追加の理解確認へ</button></form>}{pendingChallenge && <p className="pending-challenge">元の確認結果は残っています。追加の回答をもとに再評価します。</p>}</div>}
    </section>

    <section>
      <SectionTitle number={projection ? "05" : "04"} note="理由と影響を見て、今補強するか、後にするか選べます。">抜けと補強</SectionTitle>
      {!openGaps.length ? <p className="empty-state">理解確認で不足が見つかると、元の学びへ戻る場所と一緒に記録します。</p> : <div className="gap-list">{openGaps.map((gap) => <article key={gap.id}><span>{gap.status === "deferred" ? "あとで補強" : "補強おすすめ"}</span><div><h3>{gap.topic}</h3><p>{gap.reason}</p><p><strong>影響:</strong> {gap.impact}</p></div><div className="gap-actions"><button onClick={() => commitLearningState(chooseFocus(state!, { id: `reinforce-${gap.id}`, kind: "reinforce", title: gap.topic, reason: `${gap.reason}。${gap.impact}`, nodeId: gap.returnNodeId }))}>今、補強する</button><button onClick={() => commitLearningState(deferGap(state!, gap.id))}>あとで</button><button onClick={() => commitLearningState(completeReinforcement(state!, gap.id))}>補強を終えて戻る</button></div></article>)}</div>}
    </section>
    {state && <section>
      <SectionTitle number={projection ? "06" : "05"} note="使った集中資源と理解確認の結果は、別の事実として振り返ります。">配分の振り返り</SectionTitle>
      <div className="allocation-review"><form onSubmit={saveAllocation}><h3>今回使った集中資源</h3><label><span>DEPTH</span>集中の深さ<select name="depth"><option value="ear">耳・ながら</option><option value="desk">机</option><option value="deep">深い集中</option></select></label><label><span>MINUTES</span>時間（分）<input name="minutes" type="number" min="1" required /></label><label><span>NOTE</span>何に使った？<input name="allocationNote" placeholder="教材を読んだ、問題を解いたなど" /></label><button>配分として記録</button></form><div className="allocation-summary"><h3>この目的の記録</h3><strong>{state.allocations.reduce((sum, item) => sum + item.minutes, 0)}分</strong><p>理解確認: {state.checkHistory.length}回（確認できた {state.checkHistory.filter((item) => item.outcome === "confirmed").length}回）</p><small>時間を使っただけでは、理解できたことにはなりません。</small><div><button onClick={() => saveReflection("intentional")}>この偏りは意図した</button><button onClick={() => saveReflection("unintended")}>意図しない偏りだった</button></div>{state.allocationReflection && <p className="reflection-result">{state.allocationReflection.judgment === "intentional" ? "意図した偏り" : "次のおすすめへ反映"}: {state.allocationReflection.reason}</p>}</div></div>
    </section>}
    <footer><Aperture /><p>SHIBORI<br /><span>Focus on what deserves focus.</span></p></footer>
  </main>;
}

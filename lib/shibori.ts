import { z } from "zod";

import type { DeskEvaluation, FocusResource, GapEntry, LearningPosition, Projection, UserContext } from "./types";
import type { DialogLanguage } from "./i18n";

export const projectionOutputSchema = z.object({
  segments: z.array(
    z.object({
      text: z.string().max(40),
      position: z.enum(["now", "later", "unrelated", "unknown"]),
      attention: z.enum(["light", "deep"]).nullable(),
      reason: z.string().max(25),
    }),
  ),
  fit: z.object({ status: z.enum(["ready", "no_fit"]), reason: z.string() }),
  selected: z.object({ text: z.string(), attention: z.enum(["light", "deep"]), reason: z.string() }).nullable(),
  earScript: z.string().min(250).max(350).nullable(),
  deskTask: z.object({ problem: z.string(), why: z.string() }).nullable(),
  gaps: z.array(z.object({ topic: z.string(), reason: z.string() })),
});

export const projectionSchema = projectionOutputSchema.superRefine((projection, context) => {
  const nowCount = projection.segments.filter((segment) => segment.position === "now").length;
  if (projection.fit.status === "no_fit") {
    if (projection.selected || projection.earScript || projection.deskTask || nowCount) {
      context.addIssue({ code: "custom", message: "A no-fit projection cannot select learning content." });
    }
    return;
  }
  if (!projection.selected || nowCount !== 1) {
    context.addIssue({ code: "custom", message: "A ready projection must select exactly one current part." });
    return;
  }
  if (projection.selected.attention === "light" && (!projection.earScript || projection.deskTask)) {
    context.addIssue({ code: "custom", message: "Light focus must return only an ear script." });
  }
  if (projection.selected.attention === "deep" && (!projection.deskTask || projection.earScript)) {
    context.addIssue({ code: "custom", message: "Deep focus must return only a desk task." });
  }
});

export function normalizeProjection(output: z.infer<typeof projectionOutputSchema>): Projection {
  if (output.fit.status === "no_fit") {
    return {
      ...output,
      segments: output.segments.map((segment) => ({
        ...segment,
        position: segment.position === "now" ? "later" as const : segment.position,
      })),
      selected: null,
      earScript: null,
      deskTask: null,
    };
  }

  if (!output.selected) return projectionSchema.parse(output);

  const selectedText = output.selected.text.replace(/\s/g, "");
  const selectedIndex = output.segments.findIndex((segment) => {
    const segmentText = segment.text.replace(/\s/g, "");
    return segmentText === selectedText || segmentText.includes(selectedText) || selectedText.includes(segmentText);
  });
  const fallbackIndex = output.segments.findIndex((segment) => segment.position === "now");
  const nowIndex = selectedIndex >= 0 ? selectedIndex : fallbackIndex >= 0 ? fallbackIndex : 0;

  return projectionSchema.parse({
    ...output,
    segments: output.segments.map((segment, index) => ({
      ...segment,
      position: index === nowIndex ? "now" as const : segment.position === "now" ? "later" as const : segment.position,
    })),
  });
}

export const deskEvaluationSchema = z.object({
  verdict: z.enum(["mastered", "retry"]),
  feedback: z.string().min(1).max(180),
  modelAnswer: z.string().min(1).max(300),
  nextAction: z.string().min(1).max(100),
  gap: z.object({ topic: z.string(), reason: z.string() }).nullable(),
});

export const sampleMaterial = `仮説検定は、観測した差が偶然だけで説明できるかを確かめる考え方です。まず「差がない」という帰無仮説を置き、その仮説のもとで今のデータがどれほど珍しいかを評価します。結論は仮説が絶対に正しいかではなく、データと仮説の相性について述べます。

p値は、帰無仮説が正しいと仮定したとき、観測結果以上に極端なデータが得られる確率です。p値が小さいことは帰無仮説が正しい確率が低いことを直接意味しません。また、分析前に決めた有意水準と比較して判断し、都合よく基準を変えてはいけません。

母平均の検定では、z = (標本平均 − 仮説上の平均) ÷ (母標準偏差 ÷ √標本数) を計算します。母平均100、母標準偏差15の母集団から36件を抽出し、標本平均が105だったときのz統計量を求め、5%有意水準の両側検定で判断してください。

統計的な有意差と、実務で意味のある差は別物です。サンプル数が大きいと小さな差でも有意になり得ます。意思決定ではp値だけでなく、効果量、コスト、リスク、利用者への影響を合わせて考える必要があります。`;

export const sampleMaterialEn = `Hypothesis testing asks whether an observed difference can be explained by chance alone. We begin with a null hypothesis of no difference, then evaluate how unusual the current data would be in that world. The conclusion describes how well the data and hypothesis fit; it does not prove that a hypothesis is absolutely true.

A p-value is the probability, assuming the null hypothesis is true, of observing data at least as extreme as the result. A small p-value does not directly mean that the null hypothesis is unlikely to be true. Compare it with a significance level chosen before analysis rather than moving the threshold after seeing the data.

For a population mean test, calculate z = (sample mean − hypothesized mean) ÷ (population standard deviation ÷ √sample size). From a population with mean 100 and standard deviation 15, take a sample of 36 with mean 105. Calculate z and decide with a two-sided 5% significance level.

Statistical significance and practical importance are different. With a large sample, even a tiny difference can be significant. A decision should also consider effect size, cost, risk, and impact on people.`;

type PromptInput = { context: UserContext; material: string; gaps: GapEntry[]; focusResource: FocusResource; learningPosition: LearningPosition; language?: DialogLanguage };
type EvaluationPromptInput = { context: UserContext; problem: string; answer: string };

export function buildProjectionPrompt({ context, material, gaps, focusResource, learningPosition, language = "ja" }: PromptInput) {
  const unresolved = gaps.filter((gap) => !gap.resolved);
  if (language === "en") {
    const gapSection = unresolved.length
      ? unresolved.map((gap) => `- ${gap.topic}: ${gap.reason}`).join("\n")
      : "None";
    return `Write all generated fields in English. Do not use Japanese unless it appears in learner-provided content.

You are a learning-material editor who reserves the learner's deep focus for the parts that truly require it.

## Learner context
- Activity: ${context.role || "Not provided"}
- Learning goal: ${context.goal}
- Reason for learning: ${context.why || "Curiosity"}

## Unresolved gaps
${gapSection}
${unresolved.length ? "Insert a short refresher for every unresolved gap at the beginning of the listening script." : ""}

## Learning position
- Target state: ${learningPosition.targetState ?? "Not set; exploring"}
- Current position: ${learningPosition.current}
- Current focus: ${learningPosition.focus}

## Focus available now
- Time: ${focusResource.minutes} minutes
- Attention depth: ${focusResource.attention === "light" ? "light" : "deep"}

## Material
${material}

## Mapping and selection rules
- Map every paragraph to now, later, unrelated, or unknown. Use unknown when evidence is insufficient; never treat later as unnecessary.
- Preserve the source order and meaning. Summarize segments.text in at most 40 characters and reason in at most 25 characters. Set attention to null only when it cannot be determined.
- Adapt the material to the available time and attention only when the necessary learning is preserved. Select exactly one part for this session.
- If no valid part fits, return fit.status as no_fit and set selected, earScript, and deskTask to null. Explain why instead of inventing a task.
- For light attention, return only earScript: 250–350 characters, no formulas, and one analogy tied to the learner's activity. Set deskTask to null.
- For deep attention, return only deskTask: one problem requiring explanation, calculation, judgment, or recall. Set earScript to null.
- Reading, listening, or mapping material is never by itself evidence of understanding.
- Return prerequisite-gap candidates in gaps only when the material provides evidence; otherwise return an empty array.`;
  }
  const gapSection = unresolved.length
    ? unresolved.map((gap) => `- ${gap.topic}: ${gap.reason}`).join("\n")
    : "なし";

  return `生成する各項目はすべて日本語で書く。

あなたは、学習者の深い集中を本当に必要な箇所だけに配分する教材編集者です。

## ユーザーコンテキスト
- 活動: ${context.role}
- 学習目標: ${context.goal}
- 学ぶ理由: ${context.why}

## 未解決の抜けマップ
${gapSection}
${unresolved.length ? "未解決項目ごとに短い補講パートを講義スクリプト冒頭に挿入せよ。" : ""}

## 学習の現在地
- 到達状態: ${learningPosition.targetState ?? "未設定、探索中"}
- 現在地: ${learningPosition.current}
- 今の集中先: ${learningPosition.focus}

## 今回使える集中資源
- 時間: ${focusResource.minutes}分
- 注意の深さ: ${focusResource.attention === "light" ? "軽い集中" : "深い集中"}

## 教材
${material}

## 位置づけと選択のルール
- 教材の各段落を「今の集中先に使う(now)」「学習経路の後で使う(later)」「今の到達状態には関係しない(unrelated)」「情報不足で関係を判断できない(unknown)」に位置づける。
- 判断できない内容を unrelated にせず、later を不要扱いしない。教材の元の順序と内容は変更しない。
- segments.text は40字以内の要約、reason は25字以内にする。attention は必要な注意の深さ、判断不能なら null にする。
- 今回使える集中資源にそのまま合わなければ、必要な学びを損なわない範囲で小さくするか注意の深さを変え、今回着手する一つだけを selected にする。
- 変形しても成立しなければ fit.status を no_fit、selected、earScript、deskTaskを null とし、無理に課題を作らず理由を示す。
- selected が軽い集中なら earScript だけを返す。日本語250〜350字で数式を使わず、学習者の活動に寄せた例え話を1つ含める。deskTaskはnullにする。
- selected が深い集中なら deskTask だけを返す。説明、計算、判断、想起のいずれかを行う1問にし、earScriptはnullにする。
- 教材を聞いた、読んだ、位置づけた事実だけを、理解できた根拠にしない。
- 教材理解に必要な前提の欠落候補を gaps に挙げる。根拠がなければ空配列にする。`;
}

export function buildEvaluationPrompt({ context, problem, answer }: EvaluationPromptInput) {
  return `あなたは厳密だが励ます学習コーチです。今日の一問への回答を評価してください。

## 学習者
- 活動: ${context.role}
- 目標: ${context.goal}
- 理由: ${context.why}

## 問題
${problem}

## 学習者の回答
${answer}

## 評価ルール
- 最終結論だけでなく途中の考え方が説明できているかを見る。
- 正答かつ根拠が十分なら mastered、それ以外は retry。
- feedback は、できている点を先に述べ、誤りや不足を具体的に示す。
- modelAnswer は短い模範解答にする。
- nextAction は次に手を動かす一歩だけにする。
- retry の場合だけ、つまずきを gap に1件返す。mastered なら gap は null。`;
}

export function createDemoEvaluation(answer: string): DeskEvaluation {
  const normalized = answer.replace(/\s/g, "");
  const mastered = /2(?:\.0)?/.test(normalized) && /(棄却|有意)/.test(normalized);
  return mastered
    ? {
        source: "demo",
        verdict: "mastered",
        feedback: "z統計量と両側検定の結論を結びつけられています。数字を判断へ変える流れができています。",
        modelAnswer: "標準誤差は15÷6で2.5、z統計量は5÷2.5で2です。絶対値が約1.96を超えるため、5%水準で帰無仮説を棄却します。",
        nextAction: "この判断が実務上も重要な差かを一文で考える。",
        gap: null,
      }
    : {
        source: "demo",
        verdict: "retry",
        feedback: "問題へ向き合えています。まず標準誤差を出してから、平均との差を割る二段階に分けると進められます。",
        modelAnswer: "標準誤差は15÷6で2.5、z統計量は5÷2.5で2です。絶対値が約1.96を超えるため、5%水準で帰無仮説を棄却します。",
        nextAction: "紙に「15÷√36」と「5÷2.5」を順に書いて再計算する。",
        gap: { topic: "z統計量の計算", reason: "標準誤差から検定統計量を作る手順が未定着のため" },
      };
}

export function createDemoProjection(context: UserContext, gaps: GapEntry[], focusResource: FocusResource, language: DialogLanguage = "ja"): Projection {
  if (language === "en") {
    const refresher = gaps.filter((gap) => !gap.resolved)
      .map((gap) => `Refresher — ${gap.topic}: ${gap.reason}. Treat this as a foundation for the decision ahead. `).join("");
    const script = `${refresher}Hypothesis testing asks whether an observed difference could plausibly be random noise. A p-value describes how unusual the data would be in a world with no real difference; it is not the probability that the hypothesis is true. Think of an A/B test: a small win may still be a temporary wave. Statistical significance is only one lens—effect size, cost, risk, and impact on people still shape the decision.`;
    const boundedScript = script.length <= 350 ? script : script.slice(0, script.slice(0, 350).lastIndexOf(".") + 1);
    const deep = focusResource.attention === "deep" && focusResource.minutes >= 10;
    const noFit = focusResource.minutes < 5;
    const segments: Projection["segments"] = [
      { text: "Hypothesis tests distinguish chance", position: noFit ? "later" : deep ? "later" : "now", attention: "light", reason: "Works as a story" },
      { text: "A p-value is not hypothesis probability", position: "later", attention: "light", reason: "Common misconception" },
      { text: "Calculate z and make a decision", position: deep ? "now" : "later", attention: "deep", reason: "Requires worked practice" },
      { text: "Significance is not practical value", position: "later", attention: "light", reason: "Informs the decision" },
    ];
    if (noFit) return { source: "demo", segments, fit: { status: "no_fit", reason: `${focusResource.minutes} minutes is not enough to preserve the learning and include a meaningful check.` }, selected: null, earScript: null, deskTask: null, gaps: [] };
    return {
      source: "demo", segments,
      fit: { status: "ready", reason: deep ? `${focusResource.minutes} minutes of deep focus can hold one calculation and decision.` : `${focusResource.minutes} minutes of light focus can build the first mental model.` },
      selected: deep
        ? { text: "Calculate z and make a decision", attention: "deep", reason: "Check your current position with one problem" }
        : { text: "Hypothesis tests distinguish chance", attention: "light", reason: "Build the concept in a short window" },
      earScript: deep ? null : boundedScript,
      deskTask: deep ? {
        problem: "A population has mean 100 and standard deviation 15. A sample of 36 has mean 105. Calculate z and decide with a two-sided 5% significance level.",
        why: `This is one compact practice of turning a measured difference into the decision needed for ${context.why || context.goal}.`,
      } : null,
      gaps: [{ topic: "Standard error", reason: "It is the denominator used to construct the z statistic" }],
    };
  }
  const refresher = gaps
    .filter((gap) => !gap.resolved)
    .map((gap) => `【補講：${gap.topic}】${gap.reason}。まず、これは判断の土台になる言葉だと押さえましょう。`)
    .join("");

  const activityExample = context.why.includes("A/Bテスト")
    ? "新画面が少し勝っても、たまたまの波かを先に点検するA/Bテスト"
    : `${context.role || "日々の仕事"}で複数案から根拠のある一手を選ぶ場面`;
  const baseScript = `仮説検定は、見えた差が偶然でも起こりそうかを確かめる道具です。p値は「差がないと仮定した世界で、今以上に極端な結果が出る珍しさ」で、仮説が正しい確率ではありません。${context.why || "意思決定"}にたとえるなら、${activityExample}のようなものです。ただし統計的に差があっても、開発コストに見合うとは限りません。効果の大きさや利用者への影響まで見て、初めて実務の判断になります。検定は答えを自動で決める機械ではなく、判断の不確かさを見える形にするレンズです。数字の小ささだけを追わず、その差で誰の行動がどう変わるのかまで問い直しましょう。`;
  const earScript = `${refresher}${baseScript}`;

  const noFit = focusResource.minutes < 5;
  const deep = focusResource.attention === "deep" && focusResource.minutes >= 10;
  const segments: Projection["segments"] = [
    { text: "仮説検定は偶然で差を説明できるかを見る", position: noFit ? "later" : deep ? "later" : "now", attention: "light", reason: "考え方を耳でつかめる" },
    { text: "p値は仮説の確率そのものではない", position: "later", attention: "light", reason: "誤解を物語でほどける" },
    { text: "z統計量を計算し検定を判断する", position: deep ? "now" : "later", attention: "deep", reason: "計算して確かめる" },
    { text: "有意差と実務上の価値を分ける", position: "later", attention: "light", reason: "意思決定の後で使う" },
  ];

  if (noFit) return {
    source: "demo", segments,
    fit: { status: "no_fit", reason: `${focusResource.minutes}分では、必要な学びを損なわずに理解確認まで行える一つへ変形できないためです。` },
    selected: null, earScript: null, deskTask: null, gaps: [],
  };

  return {
    source: "demo",
    segments,
    fit: { status: "ready", reason: deep ? `${focusResource.minutes}分の深い集中で、計算と判断を一問に絞れます。` : `${focusResource.minutes}分の軽い集中で、最初の概念を耳からつかめます。` },
    selected: deep
      ? { text: "z統計量を計算し検定を判断する", attention: "deep", reason: "現在地を一問で確かめるため" }
      : { text: "仮説検定は偶然で差を説明できるかを見る", attention: "light", reason: "短い時間で概念をつかめるため" },
    earScript: deep ? null : (earScript.length <= 350 ? earScript : `${earScript.slice(0, 349)}。`),
    deskTask: deep ? {
      problem: "母平均100、母標準偏差15の母集団から36件を抽出し、標本平均105でした。z統計量を求め、5%有意水準の両側検定で判断してください。",
      why: `${context.why || context.goal}に必要な、差を数字で見極める基本動作を1問で固めるためです。`,
    } : null,
    gaps: [{ topic: "標準誤差", reason: "z統計量の分母を理解する前提になるため" }],
  };
}

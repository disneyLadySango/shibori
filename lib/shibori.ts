import { z } from "zod";

import type { GapEntry, Projection, UserContext } from "./types";

export const projectionSchema = z.object({
  segments: z.array(
    z.object({
      text: z.string().max(40),
      mode: z.enum(["ear", "desk"]),
      reason: z.string().max(25),
    }),
  ),
  earScript: z.string().min(250).max(350),
  deskTask: z.object({ problem: z.string(), why: z.string() }),
  gaps: z.array(z.object({ topic: z.string(), reason: z.string() })),
});

export const sampleMaterial = `仮説検定は、観測した差が偶然だけで説明できるかを確かめる考え方です。まず「差がない」という帰無仮説を置き、その仮説のもとで今のデータがどれほど珍しいかを評価します。結論は仮説が絶対に正しいかではなく、データと仮説の相性について述べます。

p値は、帰無仮説が正しいと仮定したとき、観測結果以上に極端なデータが得られる確率です。p値が小さいことは帰無仮説が正しい確率が低いことを直接意味しません。また、分析前に決めた有意水準と比較して判断し、都合よく基準を変えてはいけません。

母平均の検定では、z = (標本平均 − 仮説上の平均) ÷ (母標準偏差 ÷ √標本数) を計算します。母平均100、母標準偏差15の母集団から36件を抽出し、標本平均が105だったときのz統計量を求め、5%有意水準の両側検定で判断してください。

統計的な有意差と、実務で意味のある差は別物です。サンプル数が大きいと小さな差でも有意になり得ます。意思決定ではp値だけでなく、効果量、コスト、リスク、利用者への影響を合わせて考える必要があります。`;

type PromptInput = { context: UserContext; material: string; gaps: GapEntry[] };

export function buildProjectionPrompt({ context, material, gaps }: PromptInput) {
  const unresolved = gaps.filter((gap) => !gap.resolved);
  const gapSection = unresolved.length
    ? unresolved.map((gap) => `- ${gap.topic}: ${gap.reason}`).join("\n")
    : "なし";

  return `あなたは、学習者の深い集中を本当に必要な箇所だけに配分する教材編集者です。

## ユーザーコンテキスト
- 活動: ${context.role}
- 学習目標: ${context.goal}
- 学ぶ理由: ${context.why}

## 未解決の抜けマップ
${gapSection}
${unresolved.length ? "未解決項目ごとに短い補講パートを講義スクリプト冒頭に挿入せよ。" : ""}

## 教材
${material}

## 編集ルール
- 段落ごとに、流し聴きで理解できる概念は ear、手を動かす計算・演習は desk にする。
- segments.text は40字以内の要約、reason は25字以内にする。
- earScript は日本語250〜350字、約3分の自然な語りにする。数式や数式記号は禁止。
- earScript に学習者の活動と学ぶ理由に寄せた例え話を必ず1つ含める。
- deskTask は今日取り組む1問だけ。why はコンテキストに触れた1文にする。
- 教材理解に必要な前提の欠落候補を gaps に挙げる。根拠がなければ空配列にする。`;
}

export function createDemoProjection(context: UserContext, gaps: GapEntry[]): Projection {
  const refresher = gaps
    .filter((gap) => !gap.resolved)
    .map((gap) => `【補講：${gap.topic}】${gap.reason}。まず、これは判断の土台になる言葉だと押さえましょう。`)
    .join("");

  const activityExample = context.why.includes("A/Bテスト")
    ? "新画面が少し勝っても、たまたまの波かを先に点検するA/Bテスト"
    : `${context.role || "日々の仕事"}で複数案から根拠のある一手を選ぶ場面`;
  const baseScript = `仮説検定は、見えた差が偶然でも起こりそうかを確かめる道具です。p値は「差がないと仮定した世界で、今以上に極端な結果が出る珍しさ」で、仮説が正しい確率ではありません。${context.why || "意思決定"}にたとえるなら、${activityExample}のようなものです。ただし統計的に差があっても、開発コストに見合うとは限りません。効果の大きさや利用者への影響まで見て、初めて実務の判断になります。検定は答えを自動で決める機械ではなく、判断の不確かさを見える形にするレンズです。数字の小ささだけを追わず、その差で誰の行動がどう変わるのかまで問い直しましょう。`;
  const earScript = `${refresher}${baseScript}`;

  return {
    source: "demo",
    segments: [
      { text: "仮説検定は偶然で差を説明できるかを見る", mode: "ear", reason: "考え方を耳でつかめる" },
      { text: "p値は仮説の確率そのものではない", mode: "ear", reason: "誤解を物語でほどける" },
      { text: "z統計量を計算し検定を判断する", mode: "desk", reason: "計算して定着させる" },
      { text: "有意差と実務上の価値を分ける", mode: "ear", reason: "意思決定の視点を聴く" },
    ],
    earScript: earScript.length <= 350 ? earScript : `${earScript.slice(0, 349)}。`,
    deskTask: {
      problem: "母平均100、母標準偏差15の母集団から36件を抽出し、標本平均105でした。z統計量を求め、5%有意水準の両側検定で判断してください。",
      why: `${context.why || context.goal}に必要な、差を数字で見極める基本動作を1問で固めるためです。`,
    },
    gaps: [{ topic: "標準誤差", reason: "z統計量の分母を理解する前提になるため" }],
  };
}

# Demo video script (2:35 target)

Devpost requires a public YouTube video shorter than three minutes. Record at 1080p, keep the browser zoom near 100%, and narrate both Codex and GPT-5.6 explicitly.

## 0:00–0:20 — Problem

**Screen:** Hero and onboarding.

> Shiboriは、働きながら学ぶ人の「深く集中できる時間」を守る学習支援プロダクトです。教材を増やすのではなく、今ある教材を、耳で聴けるものと机で考えるべきものへ絞ります。

## 0:20–0:40 — Context and material

**Screen:** Enter `エンジニア兼PM / 統計を学びたい / A/Bテストを設計したい`, save, then load sample material.

> 学習者の活動、目標、理由を保存します。サンプルは、概念と計算が混ざった仮説検定の教材です。

## 0:40–1:08 — GPT-5.6 projection

**Screen:** Click 「この教材を、絞る」 and show the aperture animation, then the ear 3 / desk 1 split.

> GPT-5.6は、教材、ユーザーコンテキスト、未解決の抜けを一度のstructured output呼び出しで分析します。段落分類、3分講義、今日の一問、前提の抜けを同じ教育判断から生成するので、出力同士が分断しません。

## 1:08–1:35 — Allocation

**Screen:** Scroll to ear and desk cards. Play the audio, then enter the z-test reasoning and evaluate it.

> 耳カードは数式を語りへ変え、このユーザーにはA/Bテストの例えを使います。OpenAIの音声APIで日本語講義を再生します。机カードは選択肢を並べず、今日やる一問だけを提示します。途中の考えを書くと、GPT-5.6が答えだけでなく推論を評価し、次の一手を一つ返します。

## 1:35–2:02 — Feedback loop

**Screen:** Click 「わからなかった」 on p-value, show the gap map, then click 「もう一度、絞る」. Show the refresher at the start of the script.

> わからなかった段落は抜けマップへ入ります。もう一度絞ると、この未理解がGPT-5.6へ戻り、次の講義冒頭へ補講として挿入されます。教材が学習者の反応に合わせて変わる瞬間です。

## 2:02–2:24 — Codex

**Screen:** Brief split view of the app and repository, highlighting `lib/openai.ts`, tests, and README. Never show `.env.local`.

> このプロダクトはCodexと構築しました。Codexは公式API仕様の確認、デモを固定するテスト、Next.js実装、型検査、production build、ブラウザでのデザイン確認までを一貫して進めました。中核のGPT-5.6呼び出しとstrict schemaは公開リポジトリで確認できます。

## 2:24–2:35 — Close

**Screen:** Return to hero or aperture logo.

> Shibori。あなたの集中を、集中に値するものだけに。

## Recording checklist

- Keep the final video under 3:00 after YouTube processing.
- Ensure generated audio is audible but does not cover narration.
- Show the `GPT-5.6` source badge, not demo mode; configure `OPENAI_API_KEY` before recording.
- Use a fresh browser profile so old localStorage gaps do not alter the first run.
- Do not show API keys, terminal environment output, private Forge data, or a Codex session ID in the video.

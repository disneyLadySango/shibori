# Shibori / シボリ

教材を、移動中に聴く講義と机で解く一問に絞る「集中のポートフォリオマネージャー」です。OpenAI Build Week Education Track向けMVPとして、教材と学習者コンテキストを掛け合わせ、GPT-5.6が集中コストを配分します。

> **Education Track** — 働きながら学ぶ人の希少資源「深く集中できる時間」を、教材ではなく学習者を中心に配り直します。

## Demo flow

1. 「エンジニア兼PM / 統計を学びたい / A/Bテストを設計したい」を入力して保存します。
2. 「サンプル教材を入れる」から「この教材を、絞る」を押します。
3. 耳3段落、机1段落への仕分けと、3分講義・今日の一問を確認します。
4. APIキー設定時は「講義を再生」から日本語TTSを再生できます。
5. 段落の「わからなかった」を押し、もう一度絞ると、講義冒頭に補講が入ります。

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` に `OPENAI_API_KEY` を設定してください。キーがない場合もデモ投影でUIとフィードバックループを確認できます。画面にはデモモードであることが明示されます。

## OpenAI integration

- `gpt-5.6`: Responses APIを1回呼び出し、Zod由来のstrict structured outputで段落仕分け、講義、今日の一問、前提抜けを同時生成します。
- `gpt-4o-mini-tts`: Audio Speech APIで日本語MP3を生成します。これはLLM投影ではなく専用音声合成モデルです。
- APIキーはサーバー側だけで参照し、ブラウザへ渡しません。

GPT-5.6の中核実装は [`lib/openai.ts`](lib/openai.ts)、教材とユーザーコンテキストを掛け合わせるプロンプトは [`lib/shibori.ts`](lib/shibori.ts)、strict schemaは同ファイルの `projectionSchema` にあります。審査時にモデル活用箇所を短時間で追える構成です。

## Why GPT-5.6

Shiboriは単なる要約ではありません。ひとつの教材について、段落ごとの集中コスト、学習者の活動に寄せた比喩、今日解くべき一問、前提知識の欠落を相互に整合させる必要があります。GPT-5.6を一度のstructured output呼び出しに集約することで、耳・机・抜けマップが同じ教育判断から生成されます。未解決の抜けは次回プロンプトへ戻り、講義冒頭の補講へ変わります。

## Architecture

```text
Material ─┐
Context ──┼─> GPT-5.6 structured projection ─┬─> Ear script ─> TTS
Gap map ──┘                                  ├─> One desk task
                                            └─> Detected gaps ─┐
User: "わからなかった" ───────────────────────────────────────┘
```

## Build Week submission assets

- [`docs/DEVPOST_SUBMISSION.md`](docs/DEVPOST_SUBMISSION.md): project description and judging-criteria narrative
- [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md): public YouTube demo under three minutes, including Codex and GPT-5.6 narration
- [`LICENSE`](LICENSE): repository judging and testing license

## Local data

`UserContext` と `GapEntry` はブラウザのlocalStorageへ保存します。教材本文と生成結果はMVPでは永続化せず、認証・課金・RSS・OCR・体系的な単元依存グラフは対象外です。

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## License

MIT

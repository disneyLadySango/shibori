# Shibori / シボリ

教材を、移動中に聴く講義と机で解く一問に絞る「集中のポートフォリオマネージャー」です。OpenAI Build Week Education Track向けMVPとして、教材と学習者コンテキストを掛け合わせ、GPT-5.6が集中コストを配分します。

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

## Local data

`UserContext` と `GapEntry` はブラウザのlocalStorageへ保存します。教材本文と生成結果はMVPでは永続化せず、認証・課金・RSS・OCR・体系的な単元依存グラフは対象外です。

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

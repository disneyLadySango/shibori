# Shibori / シボリ

学習目的・到達状態・理解状態をつなぎ、「次に集中する一つ」を提案する学習支援プロダクトです。興味だけでも始められ、学びながら「何ができるようになりたいか」を見つけられます。

OpenAI Build Week Education Track向けのSlice Aでは、次の一周を実装しています。

1. 学習目的だけで探索を始める、またはCanで到達状態を置く
2. 到達状態への依存関係と現在地を可視化する
3. GPT-5.6が次の集中先を一つだけ提案する
4. 教材があれば、耳でつかむ講義と机の一問へ再編集する
5. 回答から理解状態を確認し、できた部分を残して不足だけを「抜け」にする
6. 補強を今するか後にするか選び、終えたら保存した場所へ戻る
7. ブラウザを閉じても現在地・集中先・抜けから再開する

おすすめは一つに絞りますが、学習者は別の学びを選べます。教材を読んだ・聞いたという事実だけでは理解済みにしません。

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` に `OPENAI_API_KEY` を設定してください。未設定でも、デモモードで探索・経路・理解確認・補強のループを確認できます。

## OpenAI integration

- `gpt-5.6`: 学習経路、現在地、次の集中先、理解確認の問いをstrict structured outputで提案
- `gpt-5.6`: 学習者の回答から、確認できたことと一件の抜けをstrict structured outputで判定
- `gpt-5.6`: 任意の教材を耳パート・机パート・前提の抜けへ再編集
- `gpt-4o-mini-tts`: 専用Speech APIで日本語講義を音声化（LLM判断とは区別）

中核は [`lib/openai.ts`](lib/openai.ts)、学習計画と理解確認のスキーマ・プロンプトは [`lib/planning.ts`](lib/planning.ts)、露出と理解更新を分離する状態遷移は [`lib/learning.ts`](lib/learning.ts) にあります。APIキーはサーバー側だけで参照します。

```text
学習目的 ─┬─> 探索 ─> Canの発見 ─┐
          └─> 到達状態(Can) ─────┼─> 学習経路 / 現在地
理解状態・抜け ──────────────────┘          │
                                             v
                                  GPT-5.6: 次の一つ
                                             │
                   教材 ─> 耳 / 机 <────────┤
                                             v
                                      理解確認
                                   ┌─────────┴────────┐
                                 確認              抜け
                                   │       今補強 / 後で / 別の学び
                                   └─────────> 再配分・再開
```

## Origin and roadmap

意図と成果基準の唯一の正は [`origin/`](origin/) です。ユビキタス言語、個別ユーザーストーリー、1つのストーリーマップ兼ロードマップ、ストーリー単位のAC、How単位のテスト仕様を分離しています。実装上の固定判断は [`decisions/`](decisions/) に記録します。

## Build Week assets

- [`docs/DEVPOST_SUBMISSION.md`](docs/DEVPOST_SUBMISSION.md)
- [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)
- [`LICENSE`](LICENSE)

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## License

MIT

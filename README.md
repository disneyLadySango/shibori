# Shibori / シボリ

Shibori is a focus portfolio for learning. It keeps multiple learning purposes, target states, and current understanding separate, then recommends the one next thing worth your focus. You can begin with curiosity alone and discover what you want to be able to do through learning.

Built for the OpenAI Build Week Education track. The public demo opens in English at `/`; the complete Japanese experience remains available at `/ja`. Both languages share the same locally stored learning state.

1. Start exploring from a learning purpose, or declare a target state as a Can.
2. See the dependencies and your current position on the path.
3. Let GPT-5.6 recommend one next focus, with a reason.
4. Reshape material into either a listenable explanation or one desk problem.
5. Check understanding from an answer, preserving what worked and isolating one gap.
6. Reinforce now or later, then return to the saved learning position.
7. Resume the same position, focus, and gaps after closing the browser.
8. Keep multiple purposes without mixing their paths or understanding states.
9. Receive one cross-purpose recommendation while retaining the final decision.

Shibori narrows the recommendation to one, but never takes the learner's choice away. Reading or listening alone is never treated as proof of understanding.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` in `.env.local`. Without it, the built-in sample still demonstrates exploration, planning, checking, and reinforcement.

## OpenAI integration

- `gpt-5.6`: proposes the learning path, current position, next focus, and one understanding check with strict structured output
- `gpt-5.6`: recommends one purpose from a multi-purpose portfolio, with an explicit reason
- `gpt-5.6`: evaluates what an answer demonstrates and isolates at most one actionable gap
- `gpt-5.6`: reshapes arbitrary material around the learner's available focus
- `gpt-4o-mini-tts`: turns English or Japanese listening scripts into speech; it is kept separate from LLM decisions

The OpenAI boundary lives in [`lib/openai.ts`](lib/openai.ts), cross-purpose allocation in [`lib/prioritization.ts`](lib/prioritization.ts), state isolation in [`lib/portfolio.ts`](lib/portfolio.ts), and learning-state transitions in [`lib/learning.ts`](lib/learning.ts). The API key is only read server-side.

```text
複数の学習目的 ─> GPT-5.6: おすすめ一つ ─> 学習者が最終選択
                                                    │
選択した学習目的 ┬─> 探索 ─> Canの発見 ─┐          │
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
                                   └─────────> 再配分・再開 ─> 目的を切替えても続きから
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

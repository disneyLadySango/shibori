# Devpost submission draft

## Category

Education

## Tagline

Your focus, only on what deserves it.

## Inspiration

働きながら学ぶ人に足りないのは、教材ではありません。移動中でも得られる浅い集中と、机に向かって使える希少な深い集中を、同じ教材が区別してくれないことが問題です。Shiboriはカメラの絞りのように、教材側を学習者の集中資源へ合わせます。

## What it does

Shiboriは教材テキストと「何をしている人か・何を学びたいか・なぜ今学ぶか」をGPT-5.6へ渡します。各段落を、耳で理解できる概念と、机で手を動かすべき内容へ分類します。耳パートは学習者の活動に寄せた3分講義と音声へ、机パートは「今日の一問」だけへ再構成されます。

「わからなかった」はフラットな抜けマップへ保存されます。次回の投影では未解決の抜けをプロンプトへ戻し、講義冒頭へ補講を自動挿入します。これは、反応を記録するだけではなく、次に届く教材そのものを変えるフィードバックループです。

机の一問では、学習者が途中の考えを文章で残します。GPT-5.6は最終結果だけでなく推論を評価し、具体的なフィードバック、短い模範解答、次に手を動かす一歩を返します。つまずきは同じ抜けマップへ接続され、次回の教材配分を変えます。現在の学習セッションは端末内に保存されるため、再訪時も一問の続きへ戻れます。

## How we built it

- Next.js App Router、TypeScript、React
- GPT-5.6 Responses API + Zod strict structured outputs
- OpenAI Audio Speech API (`gpt-4o-mini-tts`)
- ブラウザlocalStorageによる1ユーザーMVP永続化
- APIキーなしでも審査動線を再現できる、明示表示付きデモ投影

GPT-5.6は段落分類、耳講義、机の一問、前提抜けを一度の呼び出しで返します。同じ判断コンテキストから全出力を作るため、「耳ではAと言い、演習ではBを問う」といった分断を避けられます。

## How Codex accelerated the work

Codexを、要件から実装までの一貫した開発エージェントとして使いました。公式OpenAIドキュメントでGPT-5.6 structured outputsとTTS仕様を確認し、デモ動線をテストとして先に固定してから、API境界、UI、ローカル永続化を縦切りで実装しました。さらにlint、型検査、production build、ヘッドレスブラウザでの目視確認、完全差分の自己レビューを行いました。

重要な判断は以下です。

1. 複数のLLM呼び出しではなく、教育判断の一貫性を優先して1回のstrict structured outputへ集約する。
2. 選択肢を増やさず、耳の講義と机の一問だけを提示する。
3. 「わからなかった」を分析画面で終わらせず、次回講義の補講へ変換する。
4. APIキーなしのフォールバックを実APIのように見せず、デモモードとして明示する。

## Challenges

もっとも難しかったのは、要約・分類・演習生成を別機能にせず、一つの集中配分として整合させることでした。strict schemaに加えて、必ずユーザーコンテキストを例え話と「なぜこの一問か」へ反映させるプロンプトを設計しました。また、未解決の抜けが増えても講義の長さを保つ制約を設けました。

## Accomplishments

- サンプル教材が耳3・机1へ明瞭に分かれる縦切りデモ
- GPT-5.6の1呼び出しで4種類の教育出力を整合
- 「わからなかった」から次回補講までの実動フィードバックループ
- AI音声の明示、サーバー側APIキー、入力検証を含む審査可能な実装
- モバイルでも選択肢を増やさない一列UX

## What we learned

パーソナライズは教材を「好きな口調」に変えることではなく、限られた集中を何に使うか決めることだと学びました。また、学習履歴を精密な知識グラフにしなくても、MVPでは一つの未理解が次の教材を変える瞬間を見せるだけで価値を実証できます。

## What's next

PDF・画像OCR、生活リズムに合わせた配信、専用ポッドキャストフィード、演習結果の評価、体系的な単元依存グラフへ拡張します。最終的には教材の消費量ではなく、深い集中の投資対効果を継続的に最適化します。

## Submission checklist

- [ ] Working project URL
- [ ] Public repository URL: `https://github.com/disneyLadySango/shibori`
- [ ] Public YouTube demo under 3 minutes
- [ ] Demo audio explicitly explains both Codex and GPT-5.6 usage
- [ ] `/feedback` Codex Session ID entered in the Devpost form
- [ ] `OPENAI_API_KEY` is not committed or shown in the video
- [ ] Final submission completed before July 21, 2026 5:00 PM PDT (July 22, 2026 9:00 AM JST)

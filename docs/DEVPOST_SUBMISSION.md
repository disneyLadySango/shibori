# Devpost submission draft

## Category

Education

## Tagline

Your focus, only on what deserves it.

## Inspiration

働きながら学ぶ人に足りないのは、教材ではありません。移動中でも得られる浅い集中と、机に向かって使える希少な深い集中を、同じ教材が区別してくれないことが問題です。Shiboriはカメラの絞りのように、教材側を学習者の集中資源へ合わせます。

## What it does

Shiboriは「学びたい」という欲求だけでも始められます。到達状態がまだなければ、GPT-5.6はCanを強制せず探索を一つ提案します。Canが見つかれば、依存関係を含む学習経路、現在地、次に集中する一つを構成します。

手元の教材があれば、現在の集中先と学習者の活動に合わせて、耳で理解できる概念と机で手を動かすべき内容へ再編集します。耳パートは3分講義と音声へ、机パートは「今日の一問」だけへ変わります。

理解確認は「読んだ・聞いた」ではなく、説明・計算・判断・実行できるかを見ます。一部が不足した場合も単元全体を否定せず、できなかった部分だけを抜けとして理由・影響・元の戻り先とともに保存します。学習者は補強を今する、後にする、別の学びへ進むを選べます。

確認結果は学習経路へ戻り、次の一つを再配分します。現在地・集中先・抜けは端末内に保存されるため、再訪時も推測で作り直さず続きへ戻れます。

## How we built it

- Next.js App Router、TypeScript、React
- GPT-5.6 Responses API + Zod strict structured outputs
- OpenAI Audio Speech API (`gpt-4o-mini-tts`)
- ブラウザlocalStorageによる1ユーザーMVP永続化
- バージョン付き状態遷移とブラウザlocalStorageによる再開
- APIキーなしでも審査動線を再現できる、明示表示付きデモモード

GPT-5.6は学習経路・現在地・一つの集中先・理解確認の問いを一つのstrict structured outputで返します。回答後は、確認できたことと一件の抜けを別のstrict schemaで返します。教材投影も同じ学習者コンテキストと未解決の抜けを使います。

## How Codex accelerated the work

Codexを、要件から実装までの一貫した開発エージェントとして使いました。公式OpenAIドキュメントでGPT-5.6 structured outputsとTTS仕様を確認し、デモ動線をテストとして先に固定してから、API境界、UI、ローカル永続化を縦切りで実装しました。さらにlint、型検査、production build、ヘッドレスブラウザでの目視確認、完全差分の自己レビューを行いました。

重要な判断は以下です。

1. 複数のLLM呼び出しではなく、教育判断の一貫性を優先して1回のstrict structured outputへ集約する。
2. おすすめは一つに絞るが、学習者が別の学びを選ぶ権利を残す。
3. 教材への接触と理解確認を分離し、抜けには理由・影響・戻り先を持たせる。
4. APIキーなしのフォールバックを実APIのように見せず、デモモードとして明示する。

## Challenges

もっとも難しかったのは、要約・分類・演習生成を別機能にせず、一つの集中配分として整合させることでした。strict schemaに加えて、必ずユーザーコンテキストを例え話と「なぜこの一問か」へ反映させるプロンプトを設計しました。また、未解決の抜けが増えても講義の長さを保つ制約を設けました。

## Accomplishments

- 興味から探索し、Can、学習経路、現在地へつながる縦切りデモ
- GPT-5.6のstrict outputで一つの集中先と理解確認を整合
- 抜けの発見、補強時期の選択、元の学びへの復帰までの実動ループ
- AI音声の明示、サーバー側APIキー、入力検証を含む審査可能な実装
- モバイルでも選択肢を増やさない一列UX

## What we learned

パーソナライズは教材を「好きな口調」に変えることではなく、限られた集中を何に使うか決めることだと学びました。また、学習履歴を精密な知識グラフにしなくても、MVPでは一つの未理解が次の教材を変える瞬間を見せるだけで価値を実証できます。

## What's next

承認済みロードマップに沿って、複数の学習目的を横断する配分、生活リズムに合わせた配信、PDF・画像OCR、専用ポッドキャストフィード、より体系的な依存グラフへ拡張します。

## Submission checklist

- [ ] Working project URL
- [ ] Public repository URL: `https://github.com/disneyLadySango/shibori`
- [ ] Public YouTube demo under 3 minutes
- [ ] Demo audio explicitly explains both Codex and GPT-5.6 usage
- [ ] `/feedback` Codex Session ID entered in the Devpost form
- [ ] `OPENAI_API_KEY` is not committed or shown in the video
- [ ] Final submission completed before July 21, 2026 5:00 PM PDT (July 22, 2026 9:00 AM JST)

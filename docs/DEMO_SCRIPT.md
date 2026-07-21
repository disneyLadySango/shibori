# Demo video script (2:45 target)

Devpost提出動画は3分未満。1080p、ブラウザ100%前後で、GPT-5.6とCodexの利用を明示する。

## 0:00–0:22 — Problem

**Screen:** Hero and learning purpose.

> 学びたいことは増えるのに、深く集中できる時間は増えません。Shiboriは教材管理ではなく、学習目的・到達状態・理解状態から、いま集中する一つを決める学習支援プロダクトです。

## 0:22–0:45 — Start from desire or Can

**Screen:** Enter `統計をもっと知りたい / エンジニア兼PM / A/Bテストが気になる`. Leave Can blank and start.

> 期限や実用性がなくても始められます。到達状態がまだなければ、GPT-5.6はそれを強制せず、興味の輪郭を見つける探索を一つだけ提案します。

## 0:45–1:12 — Can, path, current position

**Screen:** Set `A/Bテストの結果を根拠つきで判断できる`, then show path and current position.

> 学びながらCanで到達状態を置くと、GPT-5.6が依存関係を含む学習経路と現在地を構成します。関係が分からないものは、理解済みと推測せず「確認中」のまま残します。

## 1:12–1:38 — One focus and material projection

**Screen:** Show one focus. Load sample material, rebuild, play ear audio and show desk task.

> おすすめは一つだけです。ただし学習者は別の学びも選べます。手元の教材があれば、現在の集中先と活動に合わせ、耳でつかむ講義と机で考える一問へGPT-5.6が再編集します。講義はOpenAIのSpeech APIで再生します。

## 1:38–2:08 — Check, gap, and choice

**Screen:** Answer the understanding check briefly to produce a gap. Show reason, impact, and the three actions.

> 読んだことではなく、説明・計算・判断できるかを確認します。一部が不足しても単元全体を否定せず、できなかった部分だけを抜けにします。理由と影響を見て、今補強する、後にする、別の学びへ進むを本人が選べます。

## 2:08–2:25 — Return and resume

**Screen:** Complete reinforcement, return to original point, reload and use resume chip.

> 補強には元の戻り先が保存されています。ブラウザを閉じても、現在地・一つの集中先・未解決の抜けから推測なしで再開します。

## 2:25–2:40 — Codex

**Screen:** Show `origin/`, `lib/learning.test.ts`, `lib/openai.ts`, and the app. Never show environment files.

> Codexとは、まず既存実装から原点を蒸留し、言葉、ユーザーストーリー、AC、17のテスト仕様を合意しました。そこから状態遷移をテスト先行で作り、GPT-5.6のstrict schema、UI、保存、production build、ブラウザ確認まで再構築しました。

## 2:40–2:45 — Close

> Shibori。学びたいを、次のひとつに。

## Recording checklist

- [ ] 3:00未満
- [ ] 実APIのGPT-5.6バッジを表示し、デモ表示を出さない
- [ ] AI音声であることが画面に見える
- [ ] 新しいブラウザプロファイルで開始
- [ ] APIキー、Forge情報、Codex Session IDを映さない

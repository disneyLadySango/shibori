# Shibori user story map

- state: `proposed`
- revision: `1`
- updated: `2026-07-20`

このファイルだけが、ユーザーストーリー全体の順序、優先順位、リリーススライスを統括する。個別ストーリーのWho / Pain / Whyは`backlog/`、`active/`、`archive/`のUS-ID文書を正とする。

## Backbone and stories

| 活動順 | 学習者の活動 | ユーザーストーリー |
| --- | --- | --- |
| 1 | 学習目的を定め、状態を管理する | US-001, US-010, US-012, US-013, US-027, US-028 |
| 2 | 学習目的までの現在地を見渡す | US-002, US-014, US-015, US-016 |
| 3 | 今使える集中資源を把握する | US-017, US-018 |
| 4 | 次の集中先を決める | US-003, US-011, US-019, US-020 |
| 5 | 学習材料を集中先へ位置づける | US-021, US-022 |
| 6 | 注意の深さを合わせる | US-004 |
| 7 | 理解証拠を示し、次の一手を知る | US-005, US-023, US-024, US-029 |
| 8 | 抜けを受け止める | US-006, US-025, US-030 |
| 9 | 集中先を再配分する | US-007 |
| 10 | 中断後に戻る | US-008 |
| 11 | 配分を振り返る | US-009, US-026 |

## Release roadmap

### Slice A — 次の一回に迷わない

- stories: US-001〜US-008, US-014〜US-025, US-027〜US-030
- boundary: 一つの学習目的
- state: `backlog`

### Slice B — 複数の学習目的でも分散しない

- stories: US-010〜US-013, US-026、およびSlice Aの関連ストーリー
- boundary: 二つ以上の学習目的を混同せず、一つを選択する
- state: `backlog`

### Slice C — 配分の妥当性を学ぶ

- stories: US-009、および必要に応じてUS-001〜US-008
- boundary: 学習量ではなく学習目的への接近を振り返る
- state: `backlog`

## Priority decision pending

Q-001への回答により、最初の承認対象をSlice Aのみ、またはSlice A + Slice Bに確定する。

## Revision history

- revision 1, 2026-07-20: 旧単一文書から、個別ストーリーを参照する唯一のストーリーマップへ再構成。

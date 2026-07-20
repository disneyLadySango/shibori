# Shibori user story map

- state: `proposed`
- revision: `1`
- updated: `2026-07-20`

このファイルだけが、ユーザーストーリー全体の順序、優先順位、リリーススライスを統括する。個別ストーリーのWho / Pain / Whyは`stories/`を正とする。

## Backbone and stories

| 活動順 | 学習者の活動 | ユーザーストーリー |
| --- | --- | --- |
| 1 | 学習目的を言葉にする | US-001 |
| 2 | 学習目的までの現在地を見渡す | US-002 |
| 3 | 次の集中先を決める | US-003 |
| 4 | 注意の深さを合わせる | US-004 |
| 5 | 理解証拠を示す | US-005 |
| 6 | 抜けを受け止める | US-006 |
| 7 | 集中先を再配分する | US-007 |
| 8 | 中断後に戻る | US-008 |
| 9 | 配分を振り返る | US-009 |

## Release roadmap

### Slice A — 次の一回に迷わない

- stories: US-001, US-002, US-003, US-004, US-005, US-006, US-007, US-008
- boundary: 一つの学習目的
- state: `proposed`

### Slice B — 複数の学習目的でも分散しない

- stories: US-001, US-002, US-003, US-006, US-007, US-008
- boundary: 二つ以上の学習目的を混同せず、一つを選択する
- state: `proposed`

### Slice C — 配分の妥当性を学ぶ

- stories: US-009、および必要に応じてUS-001〜US-008
- boundary: 学習量ではなく学習目的への接近を振り返る
- state: `backlog`

## Priority decision pending

Q-001への回答により、最初の承認対象をSlice Aのみ、またはSlice A + Slice Bに確定する。

## Revision history

- revision 1, 2026-07-20: 旧単一文書から、個別ストーリーを参照する唯一のストーリーマップへ再構成。

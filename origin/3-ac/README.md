# Acceptance criteria lifecycle

第3層は、ユーザーストーリーごとに一つ以上のACを管理する。`current`や`latest`という名前は使わない。

## 構成

- `backlog/US-xxx/AC-xxx.md`: ストーリー選択前、またはHow未選択のAC
- `active/US-xxx/AC-xxx.md`: 現在のリリーススライスで検証するAC
- `archive/YYYY/US-xxx/AC-xxx.md`: 終了したACと最終結果

## ACの状態

- `backlog`: 発見済みで、まだ実装・検証対象ではない
- `approved`: 実装・検証へ進める
- `validating`: 検証中
- `succeeded`: 成功条件を満たした
- `retired`: 撤退条件へ到達した、または課題が偽だった
- `superseded`: 別のACセットへ置き換えた

## 所有と終了

1. 各ACは`story_id`を一つだけ持つ。
2. 一つのユーザーストーリーはACを複数持てる。
3. ACごとに異なるHowと検証方法が生まれるため、第4層はAC配下へ複数のテスト仕様を追加できる。
4. 終了時は終了日、観測結果、成功または撤退の判定、関連evidence IDを追記する。
5. `backlog/`から選択したACを`active/`へ移し、終了後に`archive/YYYY/`へ移す。
6. 対応する第4層も同じUS-ID / AC-IDでarchiveへ移す。
7. 撤退または失敗の学びを第2層`history/`へ追記する。
8. 関連ストーリーは課題自体が偽でない限り維持する。

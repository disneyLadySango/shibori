# Test specification lifecycle

テスト仕様は、ユーザーストーリーとACの所有関係をパスで表す。

```text
backlog/US-xxx/AC-xxx/TS-xxx.md
active/US-xxx/AC-xxx/TS-xxx.md
archive/YYYY/US-xxx/AC-xxx/TS-xxx.md
```

## 関係

- 一つのユーザーストーリーは複数のACを持てる。
- 一つのACは複数のHowを持てる。
- Howごとに一つ以上のテスト仕様を追加できる。
- テスト仕様は観測成果だけを書き、Howの技術詳細はADRまたは射影側から`approach_ref`で参照する。

## 状態

- `backlog`: 検証候補。人間承認前を含む
- `active`: 承認済みで、現在のHowを検証する
- `archive`: Howの終了、置換、撤退後の仕様と最終結果

ACのrevisionが意味を変えた場合、テスト仕様もrevisionを増やす。過去の期待値と結果はarchiveへ残し、現在値で上書きしない。

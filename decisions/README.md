# Architecture Decision Records

`/decisions/`は射影側に属する。原点がWhy / Who / 成果を所有し、ADRは再生成で揺らしたくないHowをピン留めする。

## 状態

- `proposed`: 採用前。
- `observed`: 既存射影から逆算したが、人間がピン留めを承認していない。
- `accepted`: 再生成時に尊重する。
- `superseded`: 新しいADRに置き換えられた。
- `rejected`: 採用しない。

現在のADRはすべて`observed`であり、有効なピン留めではない。

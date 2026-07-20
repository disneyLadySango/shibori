# ADR-0001: Webアプリケーション技術スタック

- Status: observed
- Date: 2026-07-20

## Context

既存射影は、単一ユーザーがブラウザから利用する短期ハッカソン成果物として作られている。サーバー側で外部認証情報を保持し、同じコードベースで対話体験とサーバー処理を提供する必要があった。

## Observed decision

Next.js App Router、React、TypeScriptを利用し、一つのアプリケーションとして射影する。

## Consequences

- 対話体験とサーバー処理を同一リポジトリで変更できる。
- JavaScript実行環境とフレームワークの更新影響を受ける。
- 原点から別の射影を生成する場合、このADRがacceptedでなければ技術選定を再評価できる。

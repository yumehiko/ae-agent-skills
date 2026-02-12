---
name: aftereffects-cli-legacy
description: Legacy low-level After Effects operations via ae-cli command-by-command. Use only when explicit imperative editing is needed or declarative apply-scene cannot express the requested operation.
---

# aftereffects-cli-legacy

低レベル CLI 操作（命令型）のレガシースキル。  
原則は宣言型スキル `aftereffects-declarative` を優先し、このスキルは以下の場合だけ使う。

- 明示的に既存コマンド単位で編集したい
- 宣言型で未対応の操作が必要
- 調査/デバッグで単発コマンドを叩きたい

## 基本フロー

1. まず疎通確認: `ae-cli health`
2. 状態確認:
   - `ae-cli list-comps`
   - `ae-cli layers`
   - `ae-cli selected-properties`
   - `ae-cli expression-errors`
3. 必要な更新コマンドを最小回数で実行
4. 変更後に `layers` / `properties` で結果確認

## 主要コマンド（レガシー）

- comp:
  - `ae-cli create-comp ...`
  - `ae-cli set-active-comp ...`
  - `ae-cli delete-comp ...`
- レイヤー/プロパティ:
  - `ae-cli add-layer ...`
  - `ae-cli set-property ...`
  - `ae-cli set-keyframe ...`
  - `ae-cli set-expression ...`
  - `ae-cli add-effect ...`
  - `ae-cli add-essential-property ...`
  - `ae-cli add-shape-repeater ...`
- タイムライン:
  - `ae-cli set-in-out-point ...`
  - `ae-cli move-layer-time ...`
  - `ae-cli set-cti ...`
  - `ae-cli set-work-area ...`
- 構造編集:
  - `ae-cli parent-layer ...`
  - `ae-cli precompose ...`
  - `ae-cli duplicate-layer ...`
  - `ae-cli move-layer-order ...`
  - `ae-cli delete-layer ...`

## 注意

- 同じ処理を複数コマンドで繰り返す必要がある場合は、宣言型 `apply-scene` へ切り替える。
- expression の不調は `ae-cli expression-errors` で確認する。

---
name: aftereffects-cli-legacy
description: Command-by-command After Effects editing via ae-cli. Best for surgical edits on existing human-made scenes (especially partial expression/property changes) and for debugging.
---

# aftereffects-cli-legacy

低レベル CLI 操作（命令型）のスキル。  
新規構築の主軸は宣言型 `aftereffects-declarative` だが、**既存シーンへの外科的編集ではこのスキルを第一選択**にする。

## 位置づけ

- 新規を組み上げる: 宣言型 `apply-scene` が主役
- 既存を部分修正する: 本スキル（命令型）が主役
- 両者は排他的ではなく、同一作業内で併用してよい

## このスキルを使うべきケース

- 人間が作った既存シーン（scene JSON 未管理）に部分変更を入れる
- 複雑な既存レイヤーへ expression をピンポイント適用/調整する
- 既存 comp 全体を再宣言せず、1-2 箇所だけ安全に直したい
- 調査/デバッグで単発コマンドを叩きたい
- 宣言型で未対応の操作が必要

## 基本フロー

1. まず疎通確認: `ae-cli health`
2. 状態確認:
   - `ae-cli list-comps`
   - `ae-cli layers`
   - `ae-cli selected-properties`
   - `ae-cli expression-errors`
3. 必要な更新コマンドを最小回数で実行
4. 変更後に `layers` / `properties` で結果確認

## 参照ファイル（固定）

- schema: `~/ae-agent-skills/scene.schema.json`
- サンプル: `~/ae-agent-skills/references/scene.example.json`
- CLIリファレンス（日本語）: `~/ae-agent-skills/references/cli.ja.md`
- CLIリファレンス（英語）: `~/ae-agent-skills/references/cli.md`

## 宣言型へ切り替える目安

- 同種の変更を複数レイヤーへ繰り返す
- 再実行可能な形で変更履歴を残したい
- 変更対象を `layers[].id` で安定管理できる
- シーン全体を再構築/置換したい

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

## 最小手順（このまま使える）

リポジトリのファイルに依存せず、命令型だけで comp と text レイヤーを作る最小例。

```bash
ae-cli health
ae-cli create-comp --name "Skill_CLI_Minimal_Test" --width 1280 --height 720 --duration 3 --frame-rate 30
ae-cli set-active-comp --comp-name "Skill_CLI_Minimal_Test"
ae-cli add-layer --type text --name "Hello" --text "CLI skill test"
ae-cli layers
```

## 注意

- 既存シーンへの単発・部分修正は命令型の方が安全な場合が多い（影響範囲を局所化しやすい）。
- 同じ処理を複数コマンドで繰り返す必要がある場合は、宣言型 `apply-scene` へ切り替える。
- expression の不調は `ae-cli expression-errors` で確認する。
- scene JSON を一時的に作る場合は `~/ae-agent-skills/work/`（作業中）と `~/ae-agent-skills/done/`（完了保管）を使う。

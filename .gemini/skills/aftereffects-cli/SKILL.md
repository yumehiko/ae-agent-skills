---
name: aftereffects-cli
description: After Effects の操作を `ae-cli` で実行するための手順。MCP ツールではなく CLI で comp 操作、レイヤー/プロパティ取得、値設定、キーフレーム設定、expression 適用、エフェクト追加を行う依頼で使う。
---

# aftereffects-cli

After Effects 操作を `ae-cli` で実行する。

## 前提

- `ae-agent-skills` リポジトリのルートディレクトリで作業する。
- Python 環境に `ae-cli` がインストール済みである。
- このリポジトリを CEP extensions 配下へ `llm-video-agent` として配置済みである（`CSXS/`, `client/`, `host/` を含む）。
- After Effects 側で CEP ブリッジが `http://127.0.0.1:8080` で起動中である。

## 基本ルール

1. まず `ae-cli health` を実行し、ブリッジ到達性を確認する。
2. 取得系は次の順で実行する。
   - `ae-cli list-comps`
   - `ae-cli layers`
   - `ae-cli selected-properties`
   - `ae-cli properties --layer-id <id>`
3. comp 操作は次を使う。
   - `ae-cli create-comp --name "<name>" --width <w> --height <h> --duration <sec> --frame-rate <fps> [--pixel-aspect <ratio>]`
   - `ae-cli set-active-comp --comp-id <id>` または `--comp-name "<name>"`
4. 更新系は対象確認後に実行する。
   - まとまった実装は `ae-cli apply-scene --scene-file <path> [--validate-only]` を優先する。
   - `ae-cli add-layer --layer-type shape --name "<name>" [--shape-type ellipse|rect] [--shape-size <w> <h>] [--shape-position <x> <y>] [--shape-fill-color <r> <g> <b>] [--shape-fill-opacity <0-100>] [--shape-stroke-color <r> <g> <b>] [--shape-stroke-opacity <0-100>] [--shape-stroke-width <px>] [--shape-stroke-line-cap butt|round|projecting] [--shape-roundness <px>]`
   - `ae-cli add-shape-repeater --layer-id <id> [--group-index <1-based>] [--name "<name>"] [--copies <n>] [--offset <v>] [--position <x> <y>] [--scale <x> <y>] [--rotation <deg>] [--start-opacity <0-100>] [--end-opacity <0-100>]`
   - `ae-cli set-property --layer-id <id> --property-path "<path>" --value "<json>"`
   - `ae-cli set-keyframe --layer-id <id> --property-path "<path>" --time <sec> --value "<json>" [--in-interp linear|bezier|hold] [--out-interp linear|bezier|hold] [--ease-in "<json>"] [--ease-out "<json>"]`
   - `ae-cli add-essential-property --layer-id <id> --property-path "<path>" [--essential-name "<displayName>"]`
   - `ae-cli set-expression --layer-id <id> --property-path "<path>" --expression "<expr>"`
   - `ae-cli add-effect --layer-id <id> --effect-match-name "<matchName>" [--effect-name "<name>"]`
   - `ae-cli set-in-out-point --layer-id <id> [--in-point <sec>] [--out-point <sec>]`
   - `ae-cli move-layer-time --layer-id <id> --delta <sec>`
   - `ae-cli set-cti --time <sec>`
   - `ae-cli set-work-area --start <sec> --duration <sec>`
   - `ae-cli parent-layer --child-layer-id <id> (--parent-layer-id <id> | --clear-parent)`
   - `ae-cli precompose --layer-id <id> --layer-id <id> --name "<name>" [--move-all-attributes]`
   - `ae-cli duplicate-layer --layer-id <id>`
   - `ae-cli move-layer-order --layer-id <id> (--before-layer-id <id> | --after-layer-id <id> | --to-top | --to-bottom)`
   - `ae-cli delete-layer --layer-id <id>`
   - `ae-cli delete-comp (--comp-id <id> | --comp-name "<name>")`
5. 複雑な値/式はファイル入力を使う。
   - `--value-file <path>`
   - `--expression-file <path>`

## コマンド例

```bash
ae-cli health
ae-cli list-comps
ae-cli create-comp --name "Main" --width 1920 --height 1080 --duration 8 --frame-rate 30
ae-cli set-active-comp --comp-name "Main"
ae-cli layers
ae-cli properties --layer-id 1 --max-depth 2
ae-cli set-property --layer-id 1 --property-path "ADBE Transform Group.ADBE Position" --value "[960,540]"
ae-cli set-keyframe --layer-id 1 --property-path "ADBE Transform Group.ADBE Position" --time 0.5 --value "[960,540]"
ae-cli set-keyframe --layer-id 1 --property-path "ADBE Transform Group.ADBE Position" --time 1.0 --value "[960,300]" --in-interp bezier --out-interp bezier --ease-in "[0,80]" --ease-out "[0,40]"
ae-cli add-essential-property --layer-id 1 --property-path "ADBE Text Properties.ADBE Text Document" --essential-name "Search Word"
ae-cli set-expression --layer-id 1 --property-path "Transform > Position" --expression "wiggle(2,30)"
ae-cli add-effect --layer-id 1 --effect-match-name "ADBE Slider Control" --effect-name "Speed"
ae-cli add-layer --layer-type shape --name "BurstCircle" --shape-type ellipse --shape-size 720 720 --shape-fill-color 255 128 0 --shape-stroke-color 255 255 255 --shape-stroke-width 8 --shape-stroke-line-cap round
ae-cli add-shape-repeater --layer-id 1 --group-index 1 --name "BurstRepeater" --copies 12 --rotation 30 --end-opacity 0
ae-cli set-in-out-point --layer-id 1 --in-point 0.5 --out-point 6.5
ae-cli move-layer-time --layer-id 1 --delta 0.25
ae-cli set-cti --time 2.0
ae-cli set-work-area --start 1.0 --duration 4.0
ae-cli parent-layer --child-layer-id 2 --parent-layer-id 1
ae-cli precompose --layer-id 3 --layer-id 2 --name "Shot_A" --move-all-attributes
ae-cli duplicate-layer --layer-id 1
ae-cli move-layer-order --layer-id 4 --to-top
ae-cli delete-layer --layer-id 4
ae-cli delete-comp --comp-name "Shot_A"
ae-cli apply-scene --scene-file examples/scene.example.json --validate-only
ae-cli apply-scene --scene-file examples/scene.example.json
```

## トラブルシュート

- 接続失敗時:
  - After Effects と CEP パネルが起動していることを確認する。
  - `AE_BRIDGE_URL` が変更されている場合は `--base-url` で合わせる。
- 応答が `status=error` の場合:
  - 引数（`comp-id/comp-name`, `layer-id`, `property-path`, `value`, `expression`, `time`）を再確認する。
  - プロパティ名やパスを `ae-cli properties` で再取得してから再実行する。
- エフェクト追加に失敗する場合:
  - `--effect-match-name` が正しい AE の `matchName` か確認する（例: `ADBE Slider Control`）。
  - 対象レイヤーで Effect Parade（`ADBE Effect Parade`）が利用可能か確認する。
- 値設定・キーフレーム設定に失敗する場合:
  - `--value` が JSON として正しいか確認する（例: `100`, `[960,540]`, `true`）。
  - `--ease-in` / `--ease-out` は `[speed,influence]` または次元ごとの配列（例: `[[0,80],[0,40]]`）で指定する。
  - キーフレーム可能なプロパティか確認する（`ae-cli properties` で対象を再特定）。
- shape 追加時に期待した見た目にならない場合:
  - `--shape-size` はピクセル値で指定する（0 以下は内部で補正される）。
  - 色は `0-1` / `0-255` どちらでも指定可能。`255 128 0` はオレンジ。
  - 線は `--shape-stroke-*` を1つでも指定したときのみ追加される。
  - 確認は `ae-cli properties --layer-id <id> --include-group "ADBE Root Vectors Group" --max-depth 5` を使う。
- Repeater 追加で失敗する場合:
  - 対象は shape レイヤーのみ（text/solid/null には追加不可）。
  - `--group-index` は shape の Contents 配下にあるグループの 1 始まり。
  - `ae-cli properties --layer-id <id> --include-group "ADBE Root Vectors Group" --max-depth 6` で Repeater 追加結果を確認する。
- `apply-scene` で失敗する場合:
  - まず `--validate-only` で JSON の妥当性を確認する。
  - `composition` を省略する場合は AE 側で active comp が開いている必要がある。
  - `layers[].type` は `text/null/solid/shape` のいずれかにする。
  - 再実行でレイヤーを再利用したい場合は `layers[].id` を必ず指定する（未指定だと新規追加になる）。

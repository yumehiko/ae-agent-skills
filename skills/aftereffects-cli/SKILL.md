---
name: aftereffects-cli
description: Command-by-command After Effects editing and inspection via ae-cli, including PNG snapshots, comp-layer assembly, footage cuts, audio changes, whole-layer text styling, and visual-bounds alignment or distribution. Best for surgical edits, visual verification, and debugging of existing scenes.
---

# aftereffects-cli

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

1. まず `ae-cli health` で疎通と、開いている `.aep` の `project.path` を確認
2. 状態確認:
   - `ae-cli list-comps`
   - `ae-cli list-footage`
   - `ae-cli layers [--comp-id <id> | --comp-name <name>]`
   - `ae-cli selected-properties`
   - `ae-cli expression-errors [--comp-id <id> | --comp-name <name>]`
3. 必要な更新コマンドを、対象 `--comp-id` または一意な `--comp-name` を明示して最小回数で実行
4. 変更後に `layers` / `properties` で結果確認
5. 見た目が重要なら `snapshot` で指定時刻をPNG確認

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
  - `ae-cli add-comp-layer (--comp-id <source-id> | --comp-name <source-name>) [--target-comp-id <id> | --target-comp-name <name>] [--name <layer>] [--start-time <sec>] [--in-point <sec>] [--out-point <sec>]`
  - `ae-cli delete-comp ...`
- レイヤー/プロパティ:
  - `ae-cli layers [--comp-id <id> | --comp-name <name>] [--brief]`
  - `ae-cli properties (--layer-id <id> | --layer-name <name>) [--comp-id <id> | --comp-name <name>] [--property-path <matchName path>] [--include-keyframes] [--include-expression] [--include-disabled] [--filter <regex>]`
  - `ae-cli bounds (--layer-id <id> | --layer-name <name>) [--comp-id <id> | --comp-name <name>] [--time <sec>]`
  - `ae-cli snapshot (--comp-id <id> | --comp-name <name>) [--time <sec>] --out <absolute.png> [--scale <S>]`（`0 < S <= 1`）
  - `ae-cli add-layer [--comp-id <id> | --comp-name <name>] ...`
  - `ae-cli set-property ... [--comp-id <id> | --comp-name <name>]`
  - `ae-cli set-keyframe ... [--comp-id <id> | --comp-name <name>]`
  - `ae-cli set-expression ... [--comp-id <id> | --comp-name <name>]`
  - `ae-cli add-effect ... [--comp-id <id> | --comp-name <name>]`
  - `ae-cli add-essential-property ... [--comp-id <id> | --comp-name <name>]`
  - `ae-cli add-shape-repeater ... [--comp-id <id> | --comp-name <name>]`
- フッテージ:
  - `ae-cli list-footage`
  - `ae-cli import-footage --path <absolute-path> [--name <name>]`
  - `ae-cli add-footage-layer (--footage-id <id> | --footage-name <name> | --path <absolute-path>) ...`
  - `ae-cli set-footage-cut (--layer-id <id> | --layer-name <name>) --source-in <sec> --source-out <sec> --timeline-in <sec>`
- 音声:
  - `ae-cli get-layer-audio (--layer-id <id> | --layer-name <name>)`
  - `ae-cli set-layer-audio (--layer-id <id> | --layer-name <name>) [--mute | --unmute] [--level-db <dB>] [--fade-in <sec>] [--fade-out <sec>]`
- テキスト:
  - `ae-cli list-fonts [--query <text>] [--limit <count>]`
  - `ae-cli get-text-style (--layer-id <id> | --layer-name <name>) [--comp-id <id> | --comp-name <name>]`
  - `ae-cli set-text-style (--layer-id <id> | --layer-name <name>) [style options]`
  - `ae-cli set-text-style-ranges (--layer-id <id> | --layer-name <name>) --ranges-file <json>`
  - `ae-cli set-text-animators (--layer-id <id> | --layer-name <name>) --animators-file <json>`
- 配置:
  - `ae-cli align-layers (--layer-id <id>... | --layer-name <name>...) [--horizontal left|center|right] [--vertical top|center|bottom] [--reference comp|action-safe|title-safe|selection]`
  - `ae-cli distribute-layers (--layer-id <id>... | --layer-name <name>...) --axis horizontal|vertical [--mode gaps|centers] [--reference comp|action-safe|title-safe|selection]`
  - `ae-cli visual-center (--layer-id <id>... | --layer-name <name>...) [--time <sec>]`
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
ae-cli add-layer --comp-name "Skill_CLI_Minimal_Test" --layer-type text --name "Hello" --text "CLI skill test"
ae-cli set-text-style --comp-name "Skill_CLI_Minimal_Test" --layer-name "Hello" --font-size 72 --fill-color 255 255 255 --justification center
ae-cli align-layers --comp-name "Skill_CLI_Minimal_Test" --layer-name "Hello" --horizontal center --vertical center --reference title-safe
ae-cli layers --comp-name "Skill_CLI_Minimal_Test"
```

## 注意

- フッテージのカットは `--source-in` と `--source-out` を対で指定し、配置先を `--timeline-in` で指定する。
- comp内容を変更するコマンドは `--comp-id` または一意な `--comp-name` で対象を明示する。省略時だけ従来どおりactive compを使う。明示時は処理後に直前のactive compへ戻る。
- プリコンポ配置は `add-comp-layer` の `--comp-id` または一意な `--comp-name` でソース、`--target-comp-id` または一意な `--target-comp-name` で配置先を指定する。
- `import-footage` と `add-footage-layer --path` は同じファイルパスのProjectItemを再利用する。
- `set-layer-audio` の `--level-db` は左右チャンネルへ同じ値を設定する。
- `--fade-in` / `--fade-out` はレイヤーのin/outを基準にAudio Levelsキーフレームを作る。
- `--mute` / `--unmute` だけを指定した場合は既存のAudio Levelsキーフレームを保持する。
- フォント指定前に `list-fonts` を実行し、返されたPostScript名を `--font` に使う。
- `set-text-style` は指定項目だけをテキストレイヤー全体へ適用する。色は0〜1または0〜255のRGBで指定する。
- `--leading` と `--auto-leading` は併用しない。
- 文字範囲スタイルは0始まり・終端を含まないrange JSONで指定し、After Effects 24.3以降で使う。
- `set-text-animators` は `aeSceneTextAnimator:*` 管理アニメーターを置換する。人手作成アニメーターは保持する。
- `visual-center` はvisual bounds中央へアンカーを移し、Positionを補正して見た目の位置を保持する。
- 配置基準のsafe既定値はaction-safe 10%、title-safe 20%。必要なら `--margin-percent` で上書きする。
- `gaps` は実寸の隙間、`centers` は中心間隔を均等化する。`selection` は対象全体の現在の外周を保持する。
- layout対象は可視2D AVレイヤーに限る。3D、3D親子関係、Position expressionは使わない。
- 読み取り時は `layers` / `properties` / `bounds` / `expression-errors` にcompを直接指定する。viewerを切り替える必要はない。
- 通常列挙されないpropertyや1項目だけを調べる場合は `properties --property-path <matchName path>` を使う。disabled propertyを含む探索には `--include-disabled` を使う。
- `layers` の `isNull` で制御用ヌルを判別する。AE内部表現の `type: "Solid"` だけで判断しない。
- animation検証は `properties --include-keyframes`、文字や帯の実寸検証は `bounds` を使う。
- 見た目は `snapshot` で確認する。既存出力は上書きされないため、毎回一意なPNGパスを使う。
- `snapshot --scale` は0より大きく1以下。viewer tabとactive compを切り替えない。
- 既存シーンへの単発・部分修正は命令型の方が安全な場合が多い（影響範囲を局所化しやすい）。
- 同じ処理を複数コマンドで繰り返す必要がある場合は、宣言型 `apply-scene` へ切り替える。
- expression の不調は `ae-cli expression-errors` で確認する。
- scene JSON や案件固有の生成スクリプトを作る場合は、対象 `.aep` と同じ案件ディレクトリに置く。サブディレクトリ名は `_edl/` を推奨するが、既存の案件構成へ強制しない。`~/ae-agent-skills/` は横断再利用するエンジン・schema・referenceに限定し、`work/` / `done/` の二重管理は行わない。
- `apply-scene` を併用する場合は必ず `--expect-project <対象.aep>` を付け、開いているプロジェクトが一致しなければ変更前に停止させる。

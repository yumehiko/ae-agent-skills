---
name: aftereffects-declarative
description: Primary After Effects workflow using ae-cli apply-scene with declarative JSON (composition/assets/comp layers/footage cuts/audio/text styles/layout/layers/animations/expressions/parent/repeater/effect params). Use this by default for composition building and repeatable footage, audio, text, or visual-bounds layout editing.
---

# aftereffects-declarative

After Effects を宣言型 JSON で構築する標準スキル。  
**新規構築・再実行性の高い編集でこのスキルを優先**し、既存シーンの外科的な部分修正は命令型スキルを優先する。

## 目的

- 1ファイルの scene JSON で comp 構成を一括適用
- 再実行時は `layers[].id` で upsert 再利用
- 人手編集後も再適用しやすい運用に寄せる

## 使い分け（重要）

- 宣言型を使う:
  - 新規 comp / 新規レイヤー群を組み上げる
  - 同種変更を複数箇所へ展開する
  - scene JSON を成果物として残し、再実行可能にしたい
- 命令型（`aftereffects-cli`）を使う:
  - 人間が作った既存シーン（scene JSON 未管理）へ部分修正を入れる
  - 複雑な既存レイヤーに expression をピンポイント適用する
  - comp 全体の再宣言を避け、局所的に安全修正したい
- 併用方針:
  - まず命令型で調査・局所修正し、安定して繰り返す段階で宣言型へ移行する

## 基本フロー

1. `ae-cli health` で疎通と、開いている `.aep` の絶対パスを確認
2. `~/ae-agent-skills/scene.schema.json` と `~/ae-agent-skills/references/scene.example.json` を確認（フッテージ編集は `footage-edit.example.json`、プリコンポ配置は `comp-assembly.example.json` も確認）
3. 対象 `.aep` と同じ案件ディレクトリに scene JSON と案件固有の生成スクリプトを作成/更新（サブディレクトリ名は `_edl/` を推奨するが強制しない）
4. `--expect-project <対象.aep>` を付けて `--validate-only` で検証
5. 同じ `--expect-project` を付けて実適用
6. apply失敗時はCLIの `Rollback` 診断を読み、`succeeded` でもcomp / ProjectItem / layerを確認する。rollback後は内容が戻ってもdirtyがtrueになり得る
7. compを直接指定した `layers` / `properties --include-keyframes` / `bounds` / `expression-errors` で数値確認
8. `snapshot` で見た目をPNG確認
9. scene JSON は `.aep` と一緒に案件側の履歴管理・同期へ含める。作業中/完了版を別ディレクトリへコピーして二重管理しない

## 参照ファイル（固定）

- schema: `~/ae-agent-skills/scene.schema.json`
- サンプル: `~/ae-agent-skills/references/scene.example.json`
- フッテージ編集サンプル: `~/ae-agent-skills/references/footage-edit.example.json`
- プリコンポ配置サンプル: `~/ae-agent-skills/references/comp-assembly.example.json`
- CLIリファレンス（日本語）: `~/ae-agent-skills/references/cli.ja.md`
- CLIリファレンス（英語）: `~/ae-agent-skills/references/cli.md`

## ファイル運用ルール（重要）

- 横断再利用するエンジン、schema、referenceは `~/ae-agent-skills/` に置く
- 案件固有の scene JSON、EDL、生成スクリプトは対象 `.aep` と同じ案件ディレクトリに置く
- 案件ディレクトリ直下を散らかさない場合は `_edl/` を推奨のサブディレクトリ名として使う。既存の案件構成へは強制しない
- `work/` / `done/` へのコピー運用は行わない。履歴は案件側のGit、同期ストレージ、バックアップへ一本化する
- 例:
  - `ae-cli apply-scene --scene-file /path/to/project/_edl/main.scene.json --expect-project /path/to/project/main.aep --validate-only`
  - `ae-cli apply-scene --scene-file /path/to/project/_edl/main.scene.json --expect-project /path/to/project/main.aep`

## コマンド

```bash
ae-cli health
ae-cli list-footage
ae-cli apply-scene --scene-file <scene.json> --expect-project <project.aep> --validate-only
ae-cli apply-scene --scene-file <scene.json> --expect-project <project.aep>
ae-cli apply-scene --scene-file <scene.json> --expect-project <project.aep> --mode replace-managed
ae-cli apply-scene --scene-file <scene.json> --expect-project <project.aep> --mode clear-all
ae-cli layers --comp-name <comp>
ae-cli properties --layer-name <layer> --comp-name <comp> --include-group <group> --include-group-children --include-keyframes [--filter <regex>] [--include-expression] [--include-disabled]
ae-cli properties --layer-name <layer> --comp-name <comp> --property-path <matchName.path>
ae-cli bounds --layer-name <layer> --comp-name <comp> --time <sec>
ae-cli expression-errors --comp-name <comp>
ae-cli snapshot --comp-name <comp> --time <sec> --out <absolute.png> [--scale <S>] # 0 < S <= 1
```

### apply mode 指針

- `merge`（既定）: 既存維持 + 宣言分だけ upsert
- `replace-managed`: `aeSceneId:*` の管理対象だけ差し替え
- `clear-all`: comp を空にして完全再宣言

## scene 設計ルール

- `layers[].id` は必須推奨（upsert の安定キー）
- `layers[].parentId` は scene id を参照
- `parentId` を持つレイヤーの `transform` は親座標系で宣言し、初回適用と再適用で同じ値を使う
- 推測でキーを作らず、必ず `~/ae-agent-skills/scene.schema.json` を正として合わせる
- アニメーション対象プロパティは `animations` で管理
- `animations[].keyframeMode` は既定の `replace` を使い、宣言したキー集合へ完全に置換する
- 既存の宣言外キーを意図的に残す場合だけ `keyframeMode: merge` を使う
- キーを全削除する場合は `keyframes: []` を宣言する
- `keyframes: []` 後の静止値も所有する場合は、同じpathの値を `transform` または `propertyValues` に宣言する。未宣言ならAEがキー削除後に保持する値を使う
- 同じレイヤー内で同一 `propertyPath` を複数のanimationへ分割しない
- 3Dベクトルには2D入力可（`[x,y] -> [x,y,0]` 自動補完）
- Repeater は `layers[].repeaters[]`
- Effect 値は `layers[].effects[].params[]`
- expression は `layers[].expressions[]`
- Essential Graphics は `layers[].essentialProperties[]`
- フッテージは `assets[]` に1度宣言し、`type: footage` のレイヤーから `sourceId` で参照する
- 既存コンポは `assets[]` に `type: comp` と `compId` または一意な `compName` で宣言し、`type: comp` のレイヤーから `sourceId` で参照する
- コンポレイヤーの本編上の配置は `timing.startTime` / `inPoint` / `outPoint` を使う
- フッテージの `assets[].path` は絶対パス、scene JSONからの相対パス、または `${MEDIA_ROOT}/...` のような環境変数付きパスを使える。CLIは適用前に絶対パスへ解決し、未定義変数はエラーにする
- カット編集は `timing.sourceIn` / `sourceOut` / `timelineIn` を使う
- `sourceIn` と `sourceOut` は必ず対で指定し、同じ `sourceId` を複数レイヤーから参照してよい
- フッテージのカット指定と `inPoint` / `outPoint` / `startTime` は混在させない
- 音声調整はフッテージレイヤーの `audio` で宣言する
- `audio.muted` はミュート状態、`audio.levelDb` は左右共通のdB値、`audio.fadeIn` / `fadeOut` は秒数
- `audio.muted` の既定はfalse、`audio.levelDb` の既定は0 dB、未指定のフェードは0秒として、再適用時に音声状態を作り直す
- `audio.fadeIn + audio.fadeOut` はカット後のレイヤー尺以内にする
- `audio` と汎用 `animations` / `propertyValues` から同じAudio Levelsを同時管理しない
- テキストレイヤー全体のスタイルは `textStyle` で宣言する
- `textStyle.font` は `ae-cli list-fonts` で取得したPostScript名を使う
- `fillColor` / `strokeColor` は0〜1または0〜255のRGB配列を使う
- `textStyle.leading` は手動行送りへ切り替わるため、`autoLeading: true` と併用しない
- `textStyle` はレイヤー全体の基準スタイル。文字範囲は `textStyleRanges[]`、Range Selectorアニメーションは `textAnimators[]` を使う
- `textStyleRanges[]` は0始まり・終端を含まない `start` / `end` と文字スタイルを宣言する。After Effects 24.3以降が必要
- `textStyleRanges` は再適用時に基準スタイルへ戻せるよう、同じレイヤーの `textStyle` と必ず併用する
- `textAnimators[]` は `id`、Position / Scale / Opacity / Rotation、selectorのStart / End / Offset / Amountとそのanimationを宣言する
- selectorの詳細は `units`（1〜2）、`basedOn`（1〜4）、`shape`（1〜6）、`smoothness`（0〜100）、`easeHigh` / `easeLow`（-100〜100）で宣言する
- AEが通常列挙しないselector propertyの往復確認には `properties --property-path <matchName path>` を使う
- `textAnimators` を宣言したレイヤーでは `aeSceneTextAnimator:*` 管理アニメーターを置換する。人手作成の別名アニメーターは保持する
- 整列・分布はトップレベルの `layout[]` に上から順に宣言し、`layerIds` はscene layer idを参照する
- `align` は `horizontal` / `vertical`、`distribute` は `axis` と `mode: gaps | centers` を指定する
- `visual-center` はvisual bounds中央へアンカーポイントを移し、見た目の位置を保持する。通常は `align` より前に置く
- 基準は `comp` / `action-safe` / `title-safe` / `selection`。safe既定値は10% / 20%で、必要なら `marginPercent` で上書きする
- layout対象は可視2D AVレイヤーに限る。3D、3D親子関係、Position expressionは使わない
- 2D親子付きレイヤーはlayout対象にできる。親transformを含むvisual boundsから親座標系へ書き戻す
- expression 内の effect 参照は表示名ではなく matchName を推奨（例: `ADBE Slider Control-0001`）
- `easeIn` / `easeOut` は `[speed, influence]`。influenceは0.1〜100の百分率
- EffectカラーはAEネイティブRGBA `[r,g,b,a]`（0〜1）を使い、パラメータは事前に`properties`で確認する

## 再適用セマンティクス

- 既存compにも `composition.width` / `height` / `duration` / `frameRate` / `pixelAspect` を宣言値として適用する
- `--validate-only` の `compositionChanges` でcomp設定の変更予定を確認する
- animationは既定で既存キーを削除してから再構築するため、人手キーを残す場合は明示的に `keyframeMode: merge` を選ぶ
- runtime error時は専用Undo groupを自動rollbackし、transaction markerの消失で成功を検証する。markerを確認できない場合は無関係な履歴を戻さない
- rollback成功後もAEのproject dirty状態は保存時点へ戻らない場合がある。CLIは自動保存しない

## フッテージ音声の例

```json
{
  "id": "clip-01",
  "type": "footage",
  "name": "Interview 01",
  "sourceId": "interview",
  "timing": {
    "sourceIn": 12.5,
    "sourceOut": 18,
    "timelineIn": 0
  },
  "audio": {
    "muted": false,
    "levelDb": -6,
    "fadeIn": 0.5,
    "fadeOut": 0.75
  }
}
```

## テキストスタイルの例

```json
{
  "id": "title",
  "type": "text",
  "name": "Title",
  "text": "Hello Agent",
  "textStyle": {
    "font": "ArialMT",
    "fontSize": 96,
    "fillColor": [255, 240, 210],
    "strokeEnabled": true,
    "strokeColor": [18, 34, 56],
    "strokeWidth": 4,
    "tracking": 20,
    "leading": 110,
    "justification": "center"
  }
}
```

## 配置の例

```json
"layout": [
  {
    "type": "align",
    "layerIds": ["title"],
    "reference": "title-safe",
    "horizontal": "center",
    "vertical": "top",
    "offset": [0, 24]
  },
  {
    "type": "distribute",
    "layerIds": ["card-a", "card-b", "card-c"],
    "reference": "action-safe",
    "axis": "horizontal",
    "mode": "gaps"
  }
]
```

## 最小テンプレート（このまま使える）

以下を対象案件の `_edl/min.scene.json` として保存して、そのまま `validate/apply` できる。

```json
{
  "composition": {
    "name": "Skill_Minimal_Test",
    "width": 1280,
    "height": 720,
    "duration": 3,
    "frameRate": 30,
    "pixelAspect": 1,
    "createIfMissing": true,
    "setActive": true
  },
  "layers": [
    {
      "id": "t1",
      "type": "text",
      "name": "Hello",
      "text": "Skill only test",
      "textStyle": {
        "fontSize": 72,
        "fillColor": [255, 255, 255],
        "justification": "center"
      },
      "transform": {
        "position": [640, 360],
        "opacity": 100
      }
    }
  ],
  "layout": [
    {
      "type": "align",
      "layerIds": ["t1"],
      "reference": "title-safe",
      "horizontal": "center",
      "vertical": "center"
    }
  ]
}
```

```bash
ae-cli apply-scene --scene-file /path/to/project/_edl/min.scene.json --expect-project /path/to/project/main.aep --validate-only
ae-cli apply-scene --scene-file /path/to/project/_edl/min.scene.json --expect-project /path/to/project/main.aep
```

## propertyPath 運用ルール（汎用）

- 目的: 実装コードを読まずに `propertyPath` を安定して決める。
- `propertyPath` は基本的に matchName ベースで指定する（表示名依存を避ける）。
- 適用前に `ae-cli properties` で対象レイヤーの実パスを確認し、出力に合わせて JSON へ転記する。
- Shape 内部プロパティは次の順で辿る:
  - `ADBE Root Vectors Group`（Contents）
  - `ADBE Vector Group`
  - `ADBE Vectors Group`
  - 各要素（例: Shape Path / Fill / Stroke / Filter）
- Effect パラメータ参照は `layers[].effects[].params[]` でも expression でも matchName 優先にする。
- 迷ったら「推測で書く」のではなく、先に `properties` 出力を正として合わせる。

## 標準デバッグ手順（実装コードを読まない）

1. `ae-cli health` の `project.path` が対象 `.aep` と一致することを確認
2. `ae-cli apply-scene --scene-file <scene.json> --expect-project <project.aep> --validate-only`
3. `ae-cli apply-scene --scene-file <scene.json> --expect-project <project.aep>`
4. `ae-cli expression-errors --comp-name <comp>` で失敗箇所を確認
5. 対象レイヤーに対して `ae-cli properties --layer-name <layer> --comp-name <comp> --include-group <group> --include-group-children --include-keyframes` を実行し、`propertyPath` とキーを確認
6. 実寸が関係する場合は `ae-cli bounds --layer-name <layer> --comp-name <comp> --time <sec>` でcomp座標のvisual boundsを確認
7. `ae-cli snapshot --comp-name <comp> --time <sec> --out <absolute.png> [--scale 0.5]` で見た目を確認
8. scene JSON を修正して、同じ `--expect-project` を付けて再適用

## トラブル時

- validation 失敗:
  - JSON構造と型を確認
- apply失敗:
  - `Rollback: succeeded` と表示されても、`health` / `list-comps` / `list-footage` / `layers` で対象が元へ戻ったことを確認する
  - rollback後にdirtyだけがtrueなら、自動保存せず内容を確認してから保存またはproject再読み込みを判断する
  - rollback失敗または未検証なら部分変更が残り得るため、対象を確認するまで再適用しない
- expression が効かない:
  - `ae-cli expression-errors`
- 意図しない新規レイヤー作成:
  - `layers[].id` 未指定/変更を確認
- 旧レイヤーが残る:
  - `apply-scene --mode replace-managed` または `--mode clear-all` を使う
- 既存シーンへ局所修正したい / 宣言型で表現しづらい:
  - `aftereffects-cli` へ切り替え

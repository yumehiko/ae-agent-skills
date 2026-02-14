---
name: aftereffects-declarative
description: Primary After Effects workflow using ae-cli apply-scene with declarative JSON (composition/layers/animations/expressions/parent/repeater/effect params). Use this by default for composition building.
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
- 命令型（`aftereffects-cli-legacy`）を使う:
  - 人間が作った既存シーン（scene JSON 未管理）へ部分修正を入れる
  - 複雑な既存レイヤーに expression をピンポイント適用する
  - comp 全体の再宣言を避け、局所的に安全修正したい
- 併用方針:
  - まず命令型で調査・局所修正し、安定して繰り返す段階で宣言型へ移行する

## 基本フロー

1. 疎通確認: `ae-cli health`
2. scene JSON を作成/更新（作業中は `work/` 配下）
3. `--validate-only` で検証
4. 実適用
5. `layers` / `properties` / `expression-errors` で確認
6. 完了版は `done/` 配下へコピーして保管

## ファイル運用ルール（重要）

- `work/`: 作業中の scene JSON を置くディレクトリ
- `done/`: 完了した scene JSON の保管ディレクトリ
- どちらもリポジトリにはコミットしない（`.gitignore` 前提）
- 例:
  - `ae-cli apply-scene --scene-file work/main.scene.json --validate-only`
  - `ae-cli apply-scene --scene-file work/main.scene.json`

## コマンド

```bash
ae-cli health
ae-cli apply-scene --scene-file <scene.json> --validate-only
ae-cli apply-scene --scene-file <scene.json>
ae-cli apply-scene --scene-file <scene.json> --mode replace-managed
ae-cli apply-scene --scene-file <scene.json> --mode clear-all
ae-cli layers
ae-cli properties --layer-name <layer> --include-group <group> --include-group-children
ae-cli expression-errors
```

### apply mode 指針

- `merge`（既定）: 既存維持 + 宣言分だけ upsert
- `replace-managed`: `aeSceneId:*` の管理対象だけ差し替え
- `clear-all`: comp を空にして完全再宣言

## scene 設計ルール

- `layers[].id` は必須推奨（upsert の安定キー）
- `layers[].parentId` は scene id を参照
- アニメーション対象プロパティは `animations` で管理
- 3Dベクトルには2D入力可（`[x,y] -> [x,y,0]` 自動補完）
- Repeater は `layers[].repeaters[]`
- Effect 値は `layers[].effects[].params[]`
- expression は `layers[].expressions[]`
- Essential Graphics は `layers[].essentialProperties[]`
- expression 内の effect 参照は表示名ではなく matchName を推奨（例: `ADBE Slider Control-0001`）

## 最小テンプレート（このまま使える）

以下を `work/min.scene.json` として保存して、そのまま `validate/apply` できる。

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
      "transform": {
        "position": [640, 360],
        "opacity": 100
      }
    }
  ]
}
```

```bash
ae-cli apply-scene --scene-file work/min.scene.json --validate-only
ae-cli apply-scene --scene-file work/min.scene.json
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

1. `ae-cli apply-scene --scene-file <scene.json> --validate-only`
2. `ae-cli apply-scene --scene-file <scene.json>`
3. `ae-cli expression-errors` で失敗箇所を確認
4. 対象レイヤーに対して `ae-cli properties --layer-name <layer> --include-group <group> --include-group-children` を実行し、`propertyPath` を再特定
5. scene JSON の `propertyPath` を修正して再適用

## トラブル時

- validation 失敗:
  - JSON構造と型を確認
- expression が効かない:
  - `ae-cli expression-errors`
- 意図しない新規レイヤー作成:
  - `layers[].id` 未指定/変更を確認
- 旧レイヤーが残る:
  - `apply-scene --mode replace-managed` または `--mode clear-all` を使う
- 既存シーンへ局所修正したい / 宣言型で表現しづらい:
  - `aftereffects-cli-legacy` へ切り替え

---
name: aftereffects-declarative
description: Primary After Effects workflow using ae-cli apply-scene with declarative JSON (composition/layers/animations/expressions/parent/repeater/effect params). Use this by default for composition building.
---

# aftereffects-declarative

After Effects を宣言型 JSON で構築する標準スキル。  
**原則このスキルを優先**し、命令型の個別コマンドはレガシースキルへフォールバックする。

## 目的

- 1ファイルの scene JSON で comp 構成を一括適用
- 再実行時は `layers[].id` で upsert 再利用
- 人手編集後も再適用しやすい運用に寄せる

## 基本フロー

1. 疎通確認: `ae-cli health`
2. scene JSON を作成/更新
3. `--validate-only` で検証
4. 実適用
5. `layers` / `properties` / `expression-errors` で確認

## コマンド

```bash
ae-cli health
ae-cli apply-scene --scene-file <scene.json> --validate-only
ae-cli apply-scene --scene-file <scene.json>
ae-cli apply-scene --scene-file <scene.json> --mode replace-managed
ae-cli apply-scene --scene-file <scene.json> --mode clear-all
ae-cli layers
ae-cli expression-errors
```

### apply mode 指針

- `merge`（既定）: 既存維持 + 宣言分だけ upsert
- `replace-managed`: `aeSceneId:*` の管理対象だけ差し替え
- `clear-all`: comp を空にして完全再宣言

## scene 設計ルール

- 正式スキーマは `schemas/scene.schema.json` を参照
- `layers[].id` は必須推奨（upsert の安定キー）
- `layers[].parentId` は scene id を参照
- アニメーション対象プロパティは `animations` で管理
- 3Dベクトルには2D入力可（`[x,y] -> [x,y,0]` 自動補完）
- Repeater は `layers[].repeaters[]`
- Effect 値は `layers[].effects[].params[]`
- expression は `layers[].expressions[]`
- Essential Graphics は `layers[].essentialProperties[]`
- expression 内の effect 参照は表示名ではなく matchName を推奨（例: `ADBE Slider Control-0001`）

## トラブル時

- validation 失敗:
  - JSON構造と型を確認
- expression が効かない:
  - `ae-cli expression-errors`
- 意図しない新規レイヤー作成:
  - `layers[].id` 未指定/変更を確認
- 旧レイヤーが残る:
  - `apply-scene --mode replace-managed` または `--mode clear-all` を使う
- 宣言型で表現できない操作が必要:
  - `aftereffects-cli-legacy` へ切り替え

# 既存コンポから scene JSON への逆変換: 既知の制約

このドキュメントは、`manual scene -> scene JSON` 逆変換機能（v0.3計画）の設計時点で想定される未対応要素を記録する。
目的は、将来対応の優先順位を明確にし、実装時に黙って情報を落とさないための基準を共有すること。

## 前提

- 現行の宣言スキーマは `schemas/scene.schema.json`
- 現行の適用処理は `host/lib/mutation_scene_handlers.jsx` の `applyScene()`
- 現行の取得系 API は主に `host/lib/query_*_handlers.jsx` の `getLayers()` / `getProperties()` / `getExpressionErrors()` など

## 制約の分類

1. スキーマ/適用側の表現不足（JSONに表せない）
2. 取得API側の情報不足（JSONに表せても回収できない）
3. 変換ポリシー上の曖昧さ（同値だが一意に決めにくい）

## 1) スキーマ/適用側の表現不足

- レイヤー型
  - 現行 `layer.type` は `text | null | solid | shape` のみ
  - `camera` / `light` / `footage` / `audio` / `precomp` などは未対応
- レイヤースイッチ/詳細属性
  - 3Dレイヤー、ブレンドモード、トラックマット、ガイド、シャイ、ソロ、モーションブラー、時間リマップ等の専用表現がない
- コンポ詳細設定
  - Work Area など、scene で十分に保持できない情報がある
- 高度なシェイプ構造
  - 自由形状や複雑な Contents 階層を専用フィールドで完全表現できない

## 2) 取得API側の情報不足

- `getLayers()` は拡張済みだが、宣言スキーマに直接マッピングできない属性は依然としてある
- `getProperties()` は型付き値も返すが、プロパティ型によっては文字列表現へのフォールバックが残る
- expression / keyframe 取得は追加済みだが、プロパティ型によっては復元できない値がある
- keyframe の値型が複雑（Shape/Marker/Custom 等）な場合は安全のため export 対象外とする
- Essential Graphics はコントローラ名のみ取得可能で、propertyPath への逆引きは一意一致時のみ可能

## 3) 変換ポリシー上の曖昧さ

- `layers[].id` の生成規則（名前由来/UID由来/ハッシュ由来）の選択
- 同名・同型レイヤー複数時の安定マッピング
- 表示名と `matchName` のどちらを正とするか（特に effect パラメータ）
- 2D/3D値の扱い（2要素と3要素の正規化）

## v0.3での運用方針（推奨）

- 原則:
  - 対応済み要素のみを確実に export する
  - 未対応は必ず `warnings` として明示し、黙って捨てない
- 出力:
  - `scene.json` に加えて `warnings`（機械可読）を返す
  - 必要なら `report.md`（人間向け要約）も生成する
- 検証:
  - export 後に `apply-scene --validate-only` を自動実行
  - 失敗時は対象 path と理由をそのまま出す

## 将来対応バックログ（提案順）

1. 取得API拡張: expression 本文取得、keyframe 列挙、layer 詳細取得
2. scene schema 拡張: precomp/footage 等の layer type、layer switches
3. export ポリシー固定: `id` 生成規則、同名衝突時の決定ルール
4. 回帰テスト: `export -> apply -> diff` を fixture プロジェクトで自動化

## 非目標（v0.3）

- すべての AE 機能を lossless に逆変換すること
- 既存の人手プロジェクトを完全に無調整で round-trip すること

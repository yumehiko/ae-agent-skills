---
name: aftereffects-cli
description: After Effects の操作を `ae-cli` で実行するための手順。MCP ツールではなく CLI でレイヤー取得、プロパティ確認、expression 適用、エフェクト追加を行う依頼で使う。
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
   - `ae-cli layers`
   - `ae-cli selected-properties`
   - `ae-cli properties --layer-id <id>`
3. 更新系は対象確認後に実行する。
   - `ae-cli set-expression --layer-id <id> --property-path "<path>" --expression "<expr>"`
   - `ae-cli add-effect --layer-id <id> --effect-match-name "<matchName>" [--effect-name "<name>"]`
4. 複雑な式は `--expression-file` を使う。

## コマンド例

```bash
ae-cli health
ae-cli layers
ae-cli properties --layer-id 1 --max-depth 2
ae-cli set-expression --layer-id 1 --property-path "Transform > Position" --expression "wiggle(2,30)"
ae-cli add-effect --layer-id 1 --effect-match-name "ADBE Slider Control" --effect-name "Speed"
```

## トラブルシュート

- 接続失敗時:
  - After Effects と CEP パネルが起動していることを確認する。
  - `AE_BRIDGE_URL` が変更されている場合は `--base-url` で合わせる。
- 応答が `status=error` の場合:
  - 引数（`layer-id`, `property-path`, `expression`）を再確認する。
  - プロパティ名やパスを `ae-cli properties` で再取得してから再実行する。
- エフェクト追加に失敗する場合:
  - `--effect-match-name` が正しい AE の `matchName` か確認する（例: `ADBE Slider Control`）。
  - 対象レイヤーで Effect Parade（`ADBE Effect Parade`）が利用可能か確認する。

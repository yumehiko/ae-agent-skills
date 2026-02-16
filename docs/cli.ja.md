# CLI利用方法

## 基本確認

```bash
ae-cli --help
ae-cli health
ae-cli layers
```

`ae-cli` が `PATH` にない場合:

```bash
PYTHONPATH=src python3 -m ae_cli.main --help
```

デフォルトのブリッジURL:

- `AE_BRIDGE_URL` があればそれを使用
- なければ `http://127.0.0.1:8080`

## よく使うコマンド

```bash
ae-cli list-comps
ae-cli create-comp --name "Main" --width 1920 --height 1080 --duration 8 --frame-rate 30
ae-cli set-active-comp --comp-name "Main"
ae-cli selected-properties
ae-cli expression-errors
```

## 宣言的シーン適用

```bash
ae-cli apply-scene --scene-file examples/scene.example.json --validate-only
ae-cli apply-scene --scene-file examples/scene.example.json
ae-cli apply-scene --scene-file examples/scene.example.json --mode replace-managed
ae-cli apply-scene --scene-file examples/scene.example.json --mode clear-all
```

スキーマ:

- `schemas/scene.schema.json`

`apply-scene` の mode:

- `merge`（デフォルト）: upsertのみ
- `replace-managed`: 不要な `aeSceneId:*` 管理レイヤーを削除して適用
- `clear-all`: compを空にして適用

## 既存コンポの逆変換（v0.3, best effort）

```bash
ae-cli export-scene --scene-only
ae-cli export-scene --comp-name "Main" --output-file work/main.export.json
```

注意:

- `export-scene` は現在 best effort で、未対応要素は `warnings` に出力されます（`--scene-only` 以外）。
- 現在の主対応は `text/null/solid/shape`、`parentId`、`timing`、`transform`、`expressions`、`animations`、`effects`、`repeaters` です。
- 詳細は `docs/reverse-scene-limitations.ja.md` を参照してください。

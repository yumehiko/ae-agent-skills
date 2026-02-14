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

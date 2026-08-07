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

## フッテージの読み込みとカット配置

```bash
ae-cli list-footage
ae-cli import-footage --path "/absolute/path/interview.mp4" --name "Interview"
ae-cli add-footage-layer --footage-name "Interview" \
  --name "Clip 01" --source-in 12.5 --source-out 18 --timeline-in 0
ae-cli set-footage-cut --layer-name "Clip 01" \
  --source-in 13 --source-out 17.5 --timeline-in 0
```

`import-footage` は同じファイルパスのProjectItemがあれば再利用します。`add-footage-layer` では
`source-in`〜`source-out` の素材範囲を `timeline-in` から配置します。`--path` を直接指定すると、
未読み込みの場合だけimportしてからレイヤーを追加します。
既存のフッテージレイヤーは `set-footage-cut` で同じ指定方法のまま再カットできます。

## 宣言的シーン適用

```bash
ae-cli apply-scene --scene-file examples/scene.example.json --validate-only
ae-cli apply-scene --scene-file examples/scene.example.json
ae-cli apply-scene --scene-file examples/scene.example.json --mode replace-managed
ae-cli apply-scene --scene-file examples/scene.example.json --mode clear-all
```

スキーマ:

- `schemas/scene.schema.json`

フッテージ編集例（`path` を実在する絶対パスへ変更して使用）:

```bash
ae-cli apply-scene --scene-file examples/footage-edit.example.json --validate-only
ae-cli apply-scene --scene-file examples/footage-edit.example.json
```

sceneでは `assets[]` に素材を1度宣言し、複数の `type: "footage"` レイヤーから
`sourceId` で参照できます。カット範囲は `timing.sourceIn` / `sourceOut` / `timelineIn` で指定します。

`apply-scene` の mode:

- `merge`（デフォルト）: upsertのみ
- `replace-managed`: 不要な `aeSceneId:*` 管理レイヤーを削除して適用
- `clear-all`: compを空にして適用

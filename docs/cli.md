# CLI Usage

## Basic checks

```bash
ae-cli --help
ae-cli health
ae-cli layers
```

If `ae-cli` is not on your `PATH`:

```bash
PYTHONPATH=src python3 -m ae_cli.main --help
```

Default bridge URL:

- `AE_BRIDGE_URL` if set
- otherwise `http://127.0.0.1:8080`

## Common commands

```bash
ae-cli list-comps
ae-cli create-comp --name "Main" --width 1920 --height 1080 --duration 8 --frame-rate 30
ae-cli set-active-comp --comp-name "Main"
ae-cli selected-properties
ae-cli expression-errors
```

## Declarative scene apply

```bash
ae-cli apply-scene --scene-file examples/scene.example.json --validate-only
ae-cli apply-scene --scene-file examples/scene.example.json
ae-cli apply-scene --scene-file examples/scene.example.json --mode replace-managed
ae-cli apply-scene --scene-file examples/scene.example.json --mode clear-all
```

Schema:

- `schemas/scene.schema.json`

`apply-scene` modes:

- `merge` (default): upsert only
- `replace-managed`: remove unmanaged `aeSceneId:*` leftovers, then apply
- `clear-all`: clear comp, then apply

## Reverse export from existing comp (v0.3, best effort)

```bash
ae-cli export-scene --scene-only
ae-cli export-scene --comp-name "Main" --output-file work/main.export.json
```

Notes:

- `export-scene` is currently best effort and emits unsupported cases as `warnings` (unless `--scene-only` is used).
- Current focus is `text/null/solid/shape` plus `parentId`, `timing`, `transform`, `expressions`, and `animations`.
- See `docs/reverse-scene-limitations.md` for known gaps.

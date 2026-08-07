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

## Importing and cutting footage

```bash
ae-cli list-footage
ae-cli import-footage --path "/absolute/path/interview.mp4" --name "Interview"
ae-cli add-footage-layer --footage-name "Interview" \
  --name "Clip 01" --source-in 12.5 --source-out 18 --timeline-in 0
ae-cli set-footage-cut --layer-name "Clip 01" \
  --source-in 13 --source-out 17.5 --timeline-in 0
```

`import-footage` reuses a project item with the same file path. `add-footage-layer` maps the source
range from `source-in` through `source-out` onto the composition beginning at `timeline-in`. Passing
`--path` directly imports the footage only when necessary before adding the layer.
Use `set-footage-cut` to recut an existing footage layer with the same timing model.

## Declarative scene apply

```bash
ae-cli apply-scene --scene-file examples/scene.example.json --validate-only
ae-cli apply-scene --scene-file examples/scene.example.json
ae-cli apply-scene --scene-file examples/scene.example.json --mode replace-managed
ae-cli apply-scene --scene-file examples/scene.example.json --mode clear-all
```

Schema:

- `schemas/scene.schema.json`

Footage editing example (replace `path` with an existing absolute file path):

```bash
ae-cli apply-scene --scene-file examples/footage-edit.example.json --validate-only
ae-cli apply-scene --scene-file examples/footage-edit.example.json
```

Scenes declare each source once in `assets[]`. Multiple `type: "footage"` layers can reference it by
`sourceId` and select cuts with `timing.sourceIn`, `sourceOut`, and `timelineIn`.

`apply-scene` modes:

- `merge` (default): upsert only
- `replace-managed`: remove unmanaged `aeSceneId:*` leftovers, then apply
- `clear-all`: clear comp, then apply

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

## Adding an existing composition as a layer

```bash
ae-cli set-active-comp --comp-name "Main"
ae-cli add-comp-layer --comp-name "TX01_Title" \
  --name "Title 01" --start-time 2 --in-point 2 --out-point 3.8
```

`add-comp-layer` adds an existing project composition to the active composition as a precomp layer.
Select the source by unique `--comp-name` or by `--comp-id`. A composition cannot contain itself.

## Volume, mute, and fades

```bash
ae-cli get-layer-audio --layer-name "Clip 01"
ae-cli set-layer-audio --layer-name "Clip 01" \
  --unmute --level-db -6 --fade-in 0.5 --fade-out 0.75
ae-cli set-layer-audio --layer-name "Clip 01" --mute
```

`level-db` sets the same value on both channels. `fade-in` and `fade-out` are durations in seconds;
they create Audio Levels keyframes relative to the layer `inPoint` and `outPoint`. A mute-only update
preserves existing Audio Levels keyframes.

## Text style

```bash
ae-cli list-fonts --query "Noto Sans" --limit 20
ae-cli get-text-style --layer-name "Title"
ae-cli set-text-style --layer-name "Title" \
  --font "ArialMT" --font-size 96 --fill-color 255 240 210 \
  --enable-stroke --stroke-color 18 34 56 --stroke-width 4 \
  --stroke-under-fill --tracking 20 --leading 110 --justification center
```

Pass a PostScript name returned by `list-fonts` to `--font`. RGB colors accept either 0–1 or
0–255 values. `--leading` switches to manual leading and cannot be combined with `--auto-leading`.
Only specified fields are updated. Styling applies to the entire text layer; mixed character styles
and text animators are outside this release's scope.

## Alignment and distribution

```bash
ae-cli align-layers --layer-name "Title" \
  --horizontal center --vertical top --reference title-safe --offset 0 24

ae-cli distribute-layers \
  --layer-name "Card A" --layer-name "Card B" --layer-name "Card C" \
  --axis horizontal --mode gaps --reference action-safe
```

Choose `comp`, `action-safe`, `title-safe`, or `selection` as the reference. Safe-area defaults are
10% for action-safe and 20% for title-safe; override either with `--margin-percent`. `gaps` equalizes
the space between visual bounds, while `centers` equalizes center spacing. A `selection` reference
preserves the target group's current outer bounds; other references use the full reference rectangle.

Bounds account for anchor point, scale, rotation, and 2D parenting. Layout supports visible 2D AV
layers and rejects 3D layers, 3D parent chains, and Position expressions. For animated Position,
the command writes a value at `--time`.

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

Composition assembly example (create `Main`, `TX01_Title`, and `TX02_Subtitle` first):

```bash
ae-cli apply-scene --scene-file examples/comp-assembly.example.json --validate-only
ae-cli apply-scene --scene-file examples/comp-assembly.example.json
```

Scenes declare each source once in `assets[]`. Multiple `type: "footage"` layers can reference it by
`sourceId` and select cuts with `timing.sourceIn`, `sourceOut`, and `timelineIn`.
Set audio with `audio.muted`, `levelDb`, `fadeIn`, and `fadeOut` on each footage layer. Declarative
apply owns the audio state for layers with `audio`, defaults to unmuted/0 dB/no fades, and rebuilds
Audio Levels keyframes on reapply.
Text layers accept `textStyle` fields for `font`, `fontSize`, fill, stroke, `tracking`, `leading`,
`autoLeading`, and `justification`. Scene apply updates only fields declared in `textStyle`.
Top-level `layout[]` entries apply ordered `align` or `distribute` operations and reference scene
layer ids through `layerIds`. Each later operation sees the bounds produced by earlier operations.
For layers with `parentId`, declared `transform` values remain parent-local so first apply and reapply match.
To place an existing composition, declare `{"id":"tx01","type":"comp","compName":"TX01_Title"}`
in `assets[]`, then reference it with `sourceId` from a `type: "comp"` layer. Use
`timing.startTime`, `inPoint`, and `outPoint` for timeline placement.

`apply-scene` modes:

- `merge` (default): upsert only
- `replace-managed`: remove unmanaged `aeSceneId:*` leftovers, then apply
- `clear-all`: clear comp, then apply

## Declarative convergence

- Declared `composition.width`, `height`, `duration`, `frameRate`, and `pixelAspect` are applied to existing compositions as well as new ones. Validate responses report planned `compositionChanges`; apply responses report the verified results in the same field.
- Each `animations[]` entry owns its property's key set. `keyframeMode` defaults to `replace`, which removes every existing key before creating the declared keys. An empty `keyframes: []` clears the property.
- Use `"keyframeMode": "merge"` on an animation only when undeclared existing keys must remain.
- Declaring the same animation `propertyPath` more than once on a layer is a validation error.
- `easeIn` and `easeOut` use `[speed, influence]`; influence is a percentage from 0.1 through 100. Multi-dimensional properties may use one pair per dimension.
- Layout supports 2D parent chains and writes parent-local Position from visual bounds. It does not support 3D parent chains.

## Effect parameter example

```json
{
  "effects": [
    {
      "matchName": "ADBE Drop Shadow",
      "params": [
        { "propertyIndex": 1, "value": [0, 0, 0, 1] },
        { "propertyIndex": 2, "value": 60 },
        { "propertyIndex": 3, "value": 135 },
        { "propertyIndex": 4, "value": 12 },
        { "propertyIndex": 5, "value": 8 }
      ]
    }
  ]
}
```

Effect color values use AE-native normalized RGBA (four values from 0 to 1), unlike text and shape RGB values.
Parameter order varies by effect; inspect `properties --layer-name <layer> --include-group "ADBE Effect Parade" --include-group-children` before applying values.

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

`health` reports both bridge connectivity and the project currently open in After Effects:

```json
{
  "status": "ok",
  "project": {
    "path": "/absolute/path/project.aep",
    "name": "project.aep",
    "dirty": true,
    "saved": true
  }
}
```

For an unsaved project, `path` is `null` and `saved` is `false`. `dirty` is `null` when the AE host
does not expose that state. Always verify that `project.path`
matches the target `.aep` before making changes.

## Local bridge authentication

The After Effects panel creates a new authentication token each time it starts and stores it in
`~/ae-agent-skills/.bridge-token` with owner-only permissions. `ae-cli` reads this file automatically,
so no configuration is normally required.

Use `AE_BRIDGE_TOKEN_FILE` to change the file location or `AE_BRIDGE_TOKEN` when the token must be
provided directly. Do not place the token directly in command-line arguments.

The bridge accepts authenticated CLI traffic from localhost and rejects browser-originated requests.

## Common commands

```bash
ae-cli list-comps
ae-cli create-comp --name "Main" --width 1920 --height 1080 --duration 8 --frame-rate 30
ae-cli set-active-comp --comp-name "Main"
ae-cli selected-properties
ae-cli expression-errors
```

## Inspect without changing the active composition

```bash
ae-cli layers --comp-name "TX01_Title"
ae-cli layers --comp-name "TX01_Title" --brief
ae-cli expression-errors --comp-id 17
ae-cli properties --layer-name "Title" --comp-name "TX01_Title" --include-keyframes
ae-cli properties --layer-name "Title" --comp-name "TX01_Title" --filter "Opacity|Position"
ae-cli properties --layer-name "Title" --comp-name "TX01_Title" --include-expression
ae-cli properties --layer-name "Title" --comp-name "TX01_Title" --property-path "ADBE Text Properties.ADBE Text Animators"
ae-cli bounds --layer-name "Title" --comp-name "TX01_Title" --time 1.25
```

`layers`, `expression-errors`, `properties`, and `bounds` accept an optional `--comp-id` or unique
`--comp-name`. They use the active composition only when neither selector is supplied and never activate
an explicitly selected composition in the viewer. Use `--comp-id` when composition names are duplicated.

Every layer returned by `layers` includes `isNull`, allowing controller nulls to be distinguished even
though AE internally reports them as solids. `properties --include-keyframes` adds `keyframes` to every
property with time, value, in/out interpolation, and temporal ease when AE exposes it.
`layers --brief` limits CLI output to `id`, `layerUid`, `name`, `type`, and `isNull`. It leaves the
default response and bridge traffic unchanged while reducing context used before layer selection.
`properties --filter <regex>` filters CLI output after retrieval by property `name` or `path`; it does
not reduce bridge traffic. `--include-expression` adds `expression` and `expressionEnabled` only when
requested. Expression source can contain project-specific information, so request it only when needed.
`--include-disabled` includes disabled properties that the normal walker omits for diagnostics.
`--property-path <matchName path>` resolves one property without enumerating the hierarchy. It can inspect
AE properties that are not normally enumerated, such as Range Selector Units, while reducing bridge traffic.

`bounds` returns composition-space visual bounds at the requested time: `left`, `top`, `right`, `bottom`,
`width`, `height`, `centerX`, and `centerY`. It accounts for anchor point, scale, rotation, and 2D parent
transforms. Nulls, 3D layers, 3D parent chains, and layers without visual bounds return explicit errors.

## Targeting mutations at an explicit composition

Commands that mutate composition contents accept an optional `--comp-id` or unique `--comp-name`.
When specified, the bridge activates only that composition for the operation and restores the previously
active composition after either success or failure. Omitting the selector preserves the legacy behavior of
using the active composition. Explicit selectors are recommended for project work to prevent writes to the
wrong composition.

```bash
ae-cli set-property --comp-name "TX01_Title" --layer-name "Title" \
  --property-path "ADBE Transform Group.ADBE Opacity" --value 80
ae-cli set-cti --comp-id 17 --time 1.25
ae-cli add-layer --comp-name "TX01_Title" --layer-type null --name "Controller"
```

This covers layer creation; property, keyframe, expression, effect, and repeater changes; footage, audio,
text, and layout operations; timeline changes; and parent, precompose, duplicate, reorder, and delete.
Because `add-comp-layer` uses `--comp-id` / `--comp-name` for its source composition, specify its destination
with `--target-comp-id` or `--target-comp-name`.

## Composition snapshots

```bash
ae-cli snapshot --comp-name "TX01_Title" \
  --time 1.25 --out "/absolute/path/tx01-1.25.png" --scale 0.5
```

Render one composition frame to PNG. A `--comp-id` or unique `--comp-name` is required. `--time` defaults
to 0 seconds and `--scale` must be greater than 0 and at most 1 (default 1). The output directory must
already exist, and snapshot refuses to overwrite an existing file.

After Effects writes to a randomized temporary PNG in the output directory. The bridge promotes it to
the final name only after verifying the complete PNG end marker and removes it on failure. The command does not
change the viewer tab or active composition. Downscaled snapshots use a temporary composition that is
removed after rendering.

## Importing and cutting footage

```bash
ae-cli list-footage
ae-cli import-footage --path "/absolute/path/interview.mp4" --name "Interview"
ae-cli add-footage-layer --comp-name "Main" --footage-name "Interview" \
  --name "Clip 01" --source-in 12.5 --source-out 18 --timeline-in 0
ae-cli set-footage-cut --comp-name "Main" --layer-name "Clip 01" \
  --source-in 13 --source-out 17.5 --timeline-in 0
```

`import-footage` reuses a project item with the same file path. `add-footage-layer` maps the source
range from `source-in` through `source-out` onto the composition beginning at `timeline-in`. Passing
`--path` directly imports the footage only when necessary before adding the layer.
Use `set-footage-cut` to recut an existing footage layer with the same timing model.

## Adding an existing composition as a layer

```bash
ae-cli add-comp-layer --comp-name "TX01_Title" \
  --target-comp-name "Main" \
  --name "Title 01" --start-time 2 --in-point 2 --out-point 3.8
```

`add-comp-layer` adds an existing project composition to the explicit target composition, or to the active
composition when the target is omitted. Select the source by unique `--comp-name` or `--comp-id`, and the
destination by `--target-comp-name` or `--target-comp-id`. A composition cannot contain itself.

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
ae-cli get-text-style --layer-name "Title" --comp-name "TX01_Title"
ae-cli set-text-style --layer-name "Title" \
  --font "ArialMT" --font-size 96 --fill-color 255 240 210 \
  --enable-stroke --stroke-color 18 34 56 --stroke-width 4 \
  --stroke-under-fill --tracking 20 --leading 110 --justification center
```

Pass a PostScript name returned by `list-fonts` to `--font`. RGB colors accept either 0–1 or
0–255 values. `--leading` switches to manual leading and cannot be combined with `--auto-leading`.
Only specified fields are updated. Styling applies to the entire text layer. Like `layers`,
`properties`, and `bounds`, `get-text-style` accepts an optional `--comp-id` or unique `--comp-name`.

Per-character ranges and Range Selector text animators use JSON arrays:

```bash
ae-cli set-text-style-ranges --layer-name "Title" --ranges-file ranges.json
ae-cli set-text-animators --layer-name "Title" --animators-file animators.json
```

Ranges are zero-based and half-open: `{ "start": 0, "end": 3, "style": {...} }`. They support
per-range font, font size, fill, stroke, and tracking. This requires After Effects 24.3 or newer.
Text animators support Position, Scale, Opacity, and Rotation plus Range Selector Start, End, Offset,
Amount, and selector keyframes. Selectors also accept `units` (1 Percentage, 2 Index), `basedOn`
(1 Characters, 2 Characters Excluding Spaces, 3 Words, 4 Lines), `shape` (1 Square, 2 Ramp Up,
3 Ramp Down, 4 Triangle, 5 Round, 6 Smooth), `smoothness` (0–100), and `easeHigh` / `easeLow`
(-100–100).

## Alignment and distribution

```bash
ae-cli align-layers --layer-name "Title" \
  --horizontal center --vertical top --reference title-safe --offset 0 24

ae-cli distribute-layers \
  --layer-name "Card A" --layer-name "Card B" --layer-name "Card C" \
  --axis horizontal --mode gaps --reference action-safe

ae-cli visual-center --layer-name "Title" --time 0.8
```

Choose `comp`, `action-safe`, `title-safe`, or `selection` as the reference. Safe-area defaults are
10% for action-safe and 20% for title-safe; override either with `--margin-percent`. `gaps` equalizes
the space between visual bounds, while `centers` equalizes center spacing. A `selection` reference
preserves the target group's current outer bounds; other references use the full reference rectangle.

Bounds account for anchor point, scale, rotation, and 2D parenting. Layout supports visible 2D AV
layers and rejects 3D layers, 3D parent chains, and Position expressions. For animated Position,
the command writes a value at `--time`.
`visual-center` moves each anchor point to its visual-bounds center at `--time` while preserving its
composition-space appearance.

## Declarative scene apply

```bash
ae-cli apply-scene --scene-file /path/to/project/_edl/main.scene.json \
  --expect-project /path/to/project/main.aep --validate-only
ae-cli apply-scene --scene-file /path/to/project/_edl/main.scene.json \
  --expect-project /path/to/project/main.aep
ae-cli apply-scene --scene-file /path/to/project/_edl/main.scene.json \
  --expect-project /path/to/project/main.aep --mode replace-managed
ae-cli apply-scene --scene-file /path/to/project/_edl/main.scene.json \
  --expect-project /path/to/project/main.aep --mode clear-all
```

The CLI resolves `--expect-project` to an absolute path. Both validation and apply abort before any
mutation when it does not match the absolute path of the project open in After Effects. Do not omit
this guard for project work.

When an apply-time error occurs, `apply-scene` immediately Undoes its dedicated group, including
composition creation, ProjectItem imports, and layer mutations. It reports `rollback.succeeded: true`
only when its transaction marker disappears. If the marker cannot be verified, it does not risk
Undoing unrelated history. Content rollback is verified on AE 26.3, but a project that was clean may
still report `project.dirty: true` afterward. The CLI never auto-saves after an error; inspect the
`rollback` diagnostics and target composition / ProjectItems before saving or reopening the project.

Store project-specific scene JSON, EDL data, and generator scripts beside the target `.aep`. `_edl/`
is the recommended default subdirectory, not a required name; follow an existing project structure
when needed. Reserve `~/ae-agent-skills/` for reusable engines, schemas, and references; do not maintain
duplicate work/done copies.

Schema:

- `schemas/scene.schema.json`

Footage editing example (replace `path` with an existing absolute file path):

```bash
ae-cli apply-scene --scene-file examples/footage-edit.example.json --expect-project /path/to/project/main.aep --validate-only
ae-cli apply-scene --scene-file examples/footage-edit.example.json --expect-project /path/to/project/main.aep
```

Composition assembly example (create `Main`, `TX01_Title`, and `TX02_Subtitle` first):

```bash
ae-cli apply-scene --scene-file examples/comp-assembly.example.json --expect-project /path/to/project/main.aep --validate-only
ae-cli apply-scene --scene-file examples/comp-assembly.example.json --expect-project /path/to/project/main.aep
```

Higher-level DSL example for generating many telop scenes:

```bash
python examples/gen_telop.py --out-dir /path/to/project/_edl/telops
target_aep=/path/to/project/main.aep
for scene in /path/to/project/_edl/telops/*.scene.json; do
  ae-cli apply-scene --scene-file "$scene" --expect-project "$target_aep" --validate-only
done
```

The default is the macOS Japanese-capable PostScript font `HiraginoSans-W6`. On another setup,
pass a Japanese-capable PostScript name returned by `list-fonts` with `--font`.

`layers[].textStyleRanges` requires `textStyle` on the same layer so repeated application can restore
the base style. `layers[].textAnimators` replaces `aeSceneTextAnimator:*` managed animators. Put a
`layout[]` operation with `type: "visual-center"` before `align` to normalize anchors before placement.

Scenes declare each source once in `assets[]`. Multiple `type: "footage"` layers can reference it by
`sourceId` and select cuts with `timing.sourceIn`, `sourceOut`, and `timelineIn`.
In addition to absolute paths, `assets[].path` accepts paths relative to the scene JSON and environment
variables such as `${MEDIA_ROOT}/clip.mov`. The CLI resolves them to absolute paths before validation
or apply and fails when a referenced environment variable is unset.
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

Apply responses report every affected layer in `layers` / `appliedLayers`. Inspect each entry's
`id`, `layerId`, `layerName`, and `action: "created" | "updated"` to verify the result.
`newlyCreatedLayers` and `updatedLayers` provide action-specific lists. For compatibility,
the legacy `createdLayers` field remains an alias of `appliedLayers` and includes every applied layer.

## Declarative convergence

- Declared `composition.width`, `height`, `duration`, `frameRate`, and `pixelAspect` are applied to existing compositions as well as new ones. Validate responses report planned `compositionChanges`; apply responses report the verified results in the same field.
- Each `animations[]` entry owns its property's key set. `keyframeMode` defaults to `replace`, which removes every existing key before creating the declared keys. An empty `keyframes: []` clears the property. When `transform` or `propertyValues` declares a static value for the same path, apply restores that value after clearing; otherwise it leaves the value AE retains after key removal.
- Use `"keyframeMode": "merge"` on an animation only when undeclared existing keys must remain.
- Declaring the same animation `propertyPath` more than once on a layer is a validation error.
- `easeIn` and `easeOut` use `[speed, influence]`; influence is a percentage from 0.1 through 100. Multi-dimensional properties may use one pair per dimension.
- Layout supports 2D parent chains and writes parent-local Position from visual bounds. It does not support 3D parent chains.
- `textStyleRanges` reapplies half-open character ranges after `textStyle` establishes the base.
- `textAnimators` rebuilds managed animators, so selector key sets are replaced by the declaration.

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

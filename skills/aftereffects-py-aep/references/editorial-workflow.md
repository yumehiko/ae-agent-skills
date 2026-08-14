# Editorial workflow

Use this workflow only for repeated edits to simple, file-backed AV layers.

## Export and edit

```bash
python scripts/edit_edl.py export input.aep \
  --comp CutsRaw --output _automation/cuts.json
```

The JSON is `ae-agent-edl/v1`. Preserve `project.sha256`, comp/layer/source IDs, and edit only
`recordInFrame`, `recordOutFrame`, `sourceIn`, `stretch`, `name`, `position`, `scale`, and
`opacity`. `sourceOut` is informational and ignored on apply; export again to refresh it.
Set `removeUnlisted` only when every unlisted target layer is also a disposable simple editorial
layer.

Version 1 applies JSON only and updates existing layer IDs; it does not create or duplicate layers.
When topology must change, create/reuse layers in the task script first, then export a stable EDL for
subsequent timing and reframing revisions. CSV export is for review and spreadsheet exchange, not
for apply.

Apply to a new scratch AEP:

```bash
python scripts/edit_edl.py apply input.aep --edl _automation/cuts.json \
  --output _automation/scratch/cuts/run-001.aep
```

The apply command rejects a changed input hash, missing IDs, changed sources, parents, effects,
masks, mattes, expressions, animated transforms, time remap, 3D, rotation, and non-positive
stretch. Do not weaken those checks to force an edit through.

## Offline editorial proxy

```bash
python scripts/render_editorial_proxy.py _automation/cuts.json \
  --viewport-width 1080 --viewport-height 1080 \
  --output _automation/scratch/cuts/proxy-001
```

The proxy creates five sample PNGs and a contact sheet per cut, a silent H.264 proxy, and a
manifest containing source times and crop rectangles. It requires `ffmpeg`, contiguous cuts for
the MP4, positive static scale, and a viewport fully inside each source. Call the result an
offline editorial pass, never an AE visual pass.

## Reusable media labels

Store expensive human/agent observations beside automation as `scenes-labeled.json`, keyed by
the source file SHA-256. Record time range, content label, exclusion flags, subject X/Y, and the
evidence frame path. Invalidate the entry when the source hash changes. Keep this media index
separate from the EDL: observations describe source footage; the EDL describes one edit.

## Project organization

Before renaming project items, walk all property groups and collect enabled expression sources.
Search for the old comp/layer/footage names and stop on ambiguous or dynamically constructed
references. Move items with `parent_folder`; remove folders only after confirming they are empty.
Use `comment` for durable Solid/null purpose labels until the SolidSource rename bug is fixed.

# Numeric animation: independent verification and native fallback

## Resolved upstream bugs (0.15.1 → pinned 0.19.0)

The normal path is now the public py-aep API, not a native rewrite. Both failures below
were upstream bugs fixed in [v0.16.0](https://github.com/forticheprod/py-aep/releases/tag/v0.16.0)
and verified with the pinned 0.19.0. The original seconds and ease-list API calls were
valid usage. No new upstream issue was filed for already-fixed behavior.

Do not certify an animation from parser round-trip alone. A synthetic project made with
`py_aep.new()` reproduced two separate problems in **0.15.1**:

- Assigning `key.in_temporal_ease = [KeyframeEase(0, 66)]` (and out ease) looks correct in
  memory but reparses with zero influence. The 0.15.1 setters replace a cached list without
  writing the binary-backed ease. Mutating the public ease objects is **not** a general fix:
  boundary getters return detached objects, and it does not address runtime timing.
- At 30000/1001 fps, authored frames 15/45/75 survive parser round-trip, but AE 2026 reads
  approximately 0.488280/1.464840/2.441400 seconds instead of 0.5005/1.5015/2.5025.
  In that output the comp timebase was 23976, but the property tdb4 timebase was 24576.
  The same 12000 ticks therefore became 0.48828125 instead of 0.5005005 seconds.
  Upstream fixed `_animate_tdb4()` to restamp the containing comp timebase after applying
  the animated template ([fix](https://github.com/forticheprod/py-aep/blob/v0.16.0/src/py_aep/models/properties/property.py#L2776-L2785)).
  This was not a seconds/frames caller error. Do not add a guessed conversion factor.

Reproduce without customer assets:

```bash
python scripts/reproduce_keyframes.py /absolute/new-scratch-directory
# Optional contrast, also NOT a certified workaround:
python scripts/reproduce_keyframes.py /absolute/another-new-directory --ease-mode bound
```

Keep `manifest.json`, `offline-report.json`, and native property reports together. Run at
both integer and fractional frame rates when evaluating a dependency update. Regression
tests now require ease assignment and timebase consistency to pass, with no
xfail. In 0.19.0, identical synthetic inputs at 25 and 30000/1001 fps passed all nine
keys (Opacity, Position, Scale) both on initial AE open and after native save/reopen:
36 time/value/interpolation/ease checks. No scripting security preference was changed.

## Exceptional fallback: explicit intent

`scripts/native_keyframes.py` generates JSX, but **never executes it**, opens a project,
changes preferences, or bypasses approval. Its narrow JSON describes only numeric keys,
not comps, assets, general scenes, effects, expressions, text, or shape paths.

```json
{
  "version": 1,
  "timeUnit": "frames",
  "tracks": [{
    "compId": 1,
    "layerId": 13,
    "propertyPath": ["ADBE Transform Group", "ADBE Opacity"],
    "frameRate": 30,
    "keys": [
      {"time": 15, "value": 0, "interpolation": "bezier", "inEase": [[0,66]], "outEase": [[0,66]]},
      {"time": 45, "value": 100, "interpolation": "bezier", "inEase": [[0,66]], "outEase": [[0,66]]}
    ]
  }]
}
```

Use actual item/layer IDs, not array indices or ambiguous display names. The CLI's `id`
for a layer may be its 1-based index; use `layerUid` (native `Layer.id`) here. Match-name
paths reject ambiguity; repeated unnamed groups need a task-specific selector instead.
All times are composition times. `frames` requires integers and explicitly divides by
that track's frame rate; `seconds` accepts explicit finite seconds. Do not silently mix
units or change fps after authoring keys. One ease pair is used for spatial properties;
non-spatial numeric vectors use a pair for every component. Influence is percent.
The fallback intentionally uses zero spatial tangents and non-roving keys. Do not use it
to preserve custom motion paths, auto-Bezier, separated dimensions, or expression-driven
animation. It replaces **all keys on each listed property**, not other tracks.

## Safe workflow

1. Preserve the source file and its hash. Work only on a derived scratch AEP.
2. Read `ae-cli health`; record current project path and dirty state. Coordinate shared AE
   access. Never discard or auto-save somebody else's dirty project. Do not switch/open
   projects until their state is safe. Record the original project to restore afterward.
3. Open the scratch AEP. Generate an apply script with a new output and report path:

   ```bash
   python scripts/native_keyframes.py intent.json \
     --expect-project /absolute/scratch.aep --output /absolute/native-final.aep \
     --report /absolute/apply-report.json --jsx /absolute/new-apply.jsx
   ```

4. Execute through the available AE scripting mechanism. The script checks project identity,
   dirty state, file-writing permission, output existence, fps, IDs, property uniqueness,
   dimensions, interpolation and expressions **before** mutation. It never changes the
   scripting file/network preference. If permission is disabled, stop and obtain the
   user's approval for that setting rather than toggling it silently.
5. Every track's time, value, interpolation and ease is read back from AE before saving
   to the new output. Time tolerance is one tenth of a composition frame to accommodate
   AE's fractional-fps representation, not a claim of subframe-exact serialization.
   Check `ok` and `saved` in the report. A failure may leave partial
   unsaved changes in the scratch project; no automatic save/rollback is attempted.
   Inspect the actual state before retrying. Preserve the report and use new filenames.
6. A successful apply is NOT save/reopen proof. Close/reopen the saved output only after
   confirming it is clean. Generate a second script **without** `--output`, with
   `--expect-project` pointing to the saved output and a new report path. Execute it and
   require `ok=true`. Record this reopening separately: the script cannot prove that the
   human/executor reopened the project. Do not rewrite the native-final AEP with py-aep
   after verification; that reintroduces the serialization boundary.
7. Check expression errors, purge, then review boundary/hold snapshots for visual signoff.
   Restore the original clean project after a test. Native property checks are not visuals.

Keep conversation output compact: counts, pass/fail, mismatch examples, paths to full JSON.
Do not dump complete property trees or binary chunks into the working context.

Live validation on AE 2026: the fallback passed all 9 keys across Opacity, Position and
Scale at 30000/1001 fps, including native save, close/reopen and independent verification.
No visual/render pass was claimed for this structural test.

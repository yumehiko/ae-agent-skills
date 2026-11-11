---
name: aftereffects-py-aep
description: Edit, inspect, create, and validate After Effects .aep projects offline with py-aep, without opening After Effects for file-level work. Use for existing AEP template edits, composition/layer/property/keyframe/text/shape/footage/render-queue changes, batch processing, new AEP creation, or code-authored generative HTML/Canvas/WebGL animation rendered into footage. Use the bundled ae-cli only when live After Effects is required for rendering, snapshots, expression evaluation/errors, text or shape visual bounds, installed fonts/effects, or open-project runtime state.
---

# After Effects with py-aep

Release: `ae-agent-skills@0.16.0`

Use `py_aep` directly in one task-specific Python script. Do not translate the edit into
a general scene JSON or a sequence of mutation CLI commands. The narrow generative
render manifest below describes browser footage, not an AE scene graph.

## Safety contract

- Never overwrite an input or foundation `.aep`.
- Resolve every path and require a nonexistent output path.
- For an existing project, parse once; for a new project, call `py_aep.new()` once. Build and
  mutate the same object graph, then save once.
- Save to a new `.aep`; `py-aep` itself rejects an existing output.
- Reparse the output and assert the intended semantic result before reporting success.
- Preserve the task script beside the project, preferably under `_automation/`.
- Do not claim visual correctness from a successful binary round-trip.
- Write trial outputs under `_automation/scratch/<task>/`; promote only a validated,
  nonexistent final filename instead of accumulating `_v2`, `_v3`, and similar guesses.

## Python environment

The default installer supplies `~/.local/share/ae-agent-skills/bin/python`, `ae-cli`,
and `ae-generative`. Use the full managed Python path for task scripts and bundled
Python helpers, including `inspect_aep.py`; do not assume shell `python3` has py-aep.
These launchers require no activation and select the dedicated browser cache.
For pip/skill-only installs, use the user's prepared venv instead. Never fix missing
dependencies by modifying system/Homebrew Python or using `--break-system-packages`.

## Choose the starting point

- Parse an existing template when matching a series, brand system, or proven AE structure.
- Start with `py_aep.new()` when native layers, imported footage, properties, and keyframes can
  express the job without borrowing complex project parts.
- Use a minimal foundation AEP when required effects, third-party plugins, color/render setup,
  or styled components cannot be synthesized reliably from an empty project.

Do this capability check before writing the build script. Prefer the path that minimizes total
build and validation work, not the path that uses the fewest tools. For a new project, read
[references/new-project.md](references/new-project.md) and copy
`assets/new_project_template.py` into the job's `_automation/` directory.

## Code-authored generative footage (core feature)

For procedural graphics that are faster to express in HTML, Canvas, SVG, or WebGL,
read [references/generative-workflow.md](references/generative-workflow.md). Author local
code with a frame-addressable `window.renderFrame` function, render a PNG sequence with
`ae-generative render <scene-dir> --output <new-dir>`, then import it with
`ae_generative.aep.import_render` in the same task-specific py-aep script.
The installed skill also includes `scripts/render_generative.py` and the runtime package.

This is a standard part of this skill, not an optional AE plugin. Python Playwright and a
Chromium browser binary are required (`ae-generative setup`). Only execute trusted,
locally authored scene code. The output is raster footage, not AE-native shapes:
AE layers, transforms, and effects remain editable; change the archived source and rerender
for pixel changes. Determinism is scoped to the same browser/runtime. Rendering browser
frames is not an AE visual pass.

## Existing-project workflow

1. Confirm the input path and record its SHA-256.
2. Get a compact inventory. Run `scripts/inspect_aep.py <input.aep>` from this skill;
   it prints a comp summary by default. Add `--comp <name>` or `--comp-id <id>` and
   `--brief` for timing, source, and evaluated transform data. Use `--output` to keep
   large results out of conversation context.
3. Inspect objects in Python. Filter by type, ID, name, comment, source, or match name;
   do not dump every property tree into context.
4. Write one Python script that parses, mutates, saves to a new path, reparses, and asserts.
5. Run the script and confirm the input SHA-256 did not change.
6. Use live AE checks only for the runtime-dependent facts listed below.
7. Copy [references/preview-feedback.ja.md](references/preview-feedback.ja.md) beside the
   task script and record evidence there; no user-specific installation path is required.

Use the installed package source and [py-aep documentation](https://forticheprod.github.io/py-aep/)
for API details instead of copying the API surface into task context.
Read [references/api-notes.md](references/api-notes.md) when property, item, keyframe, or
shape traversal is unclear.

## Editing pattern

```python
from pathlib import Path
import py_aep

source = Path("/absolute/project.aep").resolve()
output = Path("/absolute/project.py-aep-preview.aep").resolve()
if source == output or output.exists():
    raise RuntimeError("Use a new output path")

app = py_aep.parse(source)
project = app.project

matches = [c for c in project.compositions if c.name == "Main"]
if len(matches) != 1:
    raise RuntimeError(f"Expected one Main comp, found {len(matches)}")
comp = matches[0]

# Perform all task mutations here on the same object graph.

project.save(output)

check = py_aep.parse(output).project
check_matches = [c for c in check.compositions if c.name == "Main"]
assert len(check_matches) == 1
```

Prefer object references after resolving them once. Names are not stable identifiers unless
uniqueness was checked. Inspect signatures or docstrings when an API is uncertain:

```python
import inspect
print(inspect.signature(comp.precompose))
print(inspect.getdoc(type(comp)))
```

Keep one task script as the orchestrator. For repeated cut, retime, or static reframe work,
separate the narrow edit data from the mechanism instead of embedding every cut in that script.
Read [references/editorial-workflow.md](references/editorial-workflow.md), then use
`scripts/edit_edl.py` and `scripts/render_editorial_proxy.py`. Do not use this EDL as a general
scene-description language.

Project-panel cleanup is a strong offline use case. Before renaming comps, layers, or footage,
scan every enabled expression source for name references; reject ambiguous names and preserve
nonempty folders. Solid and placeholder footage names persist in the pinned py-aep 0.19.0; still reparse
the saved output and assert every intended rename.

## Animation verification

For a single key, use `key.time = seconds` to move it or `prop.remove_key(index)`
to delete it (zero-based). Do not rebuild the track. Follow
[references/single-key-edits.md](references/single-key-edits.md) for selection,
collision/roving guards, metadata preservation, and save/reopen checks.

For modified numeric animation, read
[references/keyframe-verification.md](references/keyframe-verification.md). The pinned py-aep 0.19.0
fixes the ease/timebase bugs reproduced in 0.15.1. Use the public keyframe APIs normally;
do not apply an unconditional native rewrite. Independently check modified animation in
AE (time, value, interpolation and ease), including after save/reopen, before signoff.
The guarded native fallback is only for a demonstrated unsupported case or mismatch,
not the default authoring route. A file pass is not an animation pass.

Before opening any output in AE, check `health` and preserve the existing project and
unsaved changes. Coordinate shared app access; never auto-save/discard another task.

## Runtime boundary

Use the strict offline editorial proxy for source-content, cut-boundary, and axis-aligned crop
decisions when its preflight accepts every layer. Use `ae-cli` only after opening the new output
in After Effects when the task needs:

- `purge`: clear RAM and disk caches before visual validation
- `snapshot`: rendered PNG evidence
- `expression-errors`: actual expression-engine diagnostics
- `bounds`: text or shape visual ink bounds
- `list-fonts`: fonts installed in the running AE environment
- `properties`: comparison against AE's runtime-synthesized property state
- `health`: identity and dirty state of the project currently open in AE

Expression source can be read and written offline, but its result cannot be evaluated.
Text and shape structures can be edited offline, but their rendered visual bounds are not
available from `py-aep`. Arbitrary new effects may require an effect definition already stored
in the project; treat failure to add one as unsupported rather than synthesizing binary data.

Treat structural duplication as high risk. Cross-comp `copy_to_comp()` clears parent and matte
references and may change appearance. Do not use it on parented/matted layers. For a duplicated
comp containing parents, mattes, effects, or Essential Properties, keep the original until a
fresh AE structure and visual check passes.

## Validation levels

- File pass: output reparses and semantic assertions pass.
- Offline editorial pass: the strict proxy reproduced source selection, timing, and supported
  crop geometry. This is independent evidence, not an AE render.
- AE structure pass: AE opens it and expected comps/layers/properties are present.
- Visual pass: after opening the output, `ae-cli purge` succeeded and fresh snapshots or
  renders were reviewed at every modified transition boundary plus representative hold frames.

Offline-derived projects can reuse stale frames from a predecessor project even when the file
and live properties are correct. Never claim a visual pass unless all memory and disk caches
were purged immediately beforehand. If `ae-cli purge` is unavailable, use AE's
Edit > Purge > All Memory & Disk Cache manually. State exactly which validation level was
reached; a file pass alone is not a visual pass.

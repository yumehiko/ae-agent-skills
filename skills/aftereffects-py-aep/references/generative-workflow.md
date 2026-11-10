# Code-authored generative footage

Use the core browser renderer for graphics that are easier to author in HTML/Canvas,
SVG, or WebGL. No third-party AE plugin or external rendering service is required.
This is a footage workflow, not a converter from web graphics to native AE shapes.

## Prerequisites

The default npm installer automatically creates an isolated Python environment,
stable launchers, and a browser cache under `~/.local/share/ae-agent-skills/`.
It does not install into system/Homebrew Python or require manual venv activation.
Use the managed interpreter for task scripts importing `py_aep` or `ae_generative`:

```bash
export PATH="$HOME/.local/share/ae-agent-skills/bin:$PATH"
"$HOME/.local/share/ae-agent-skills/bin/python" /absolute/task.py
"$HOME/.local/share/ae-agent-skills/bin/ae-generative" setup
```

The launchers select the current managed venv and its browser cache. An existing
pip-installed command may select a different Python; use the absolute paths above
when diagnosing installation. Package upgrades are validated in a new environment
before switching, with older working environments retained. If Chromium download
fails, the CLI and skill remain installed, and the installer reports incomplete
browser setup. Retry `ae-generative setup` or rerun the installer with
`--skip-extension`. A missing managed Chromium is an error, not a silent system
Chrome fallback. `--browser /absolute/chromium` is an explicit alternative.

Python 3.10+ with venv and Node 18+ are required for the npm installer. Full AE
installation targets macOS; Linux offline rendering may require OS libraries:
`"$HOME/.local/share/ae-agent-skills/bin/python" -m playwright install --with-deps chromium`.
Windows is not supported by the npm installer. First setup downloads from GitHub,
PyPI and Playwright; allow roughly 1 GB plus source archives, sequences, and retained
upgrade environments. Browsers are not included in the npm/ZXP archive.

`--skip-cli` copies only the skill's renderer, example, and reference without
preparing Python/browser dependencies. For pip or skill-only installation, create
and activate your own venv, install `py-aep==0.19.0` and `playwright==1.65.0`, then
run `python -m playwright install chromium` with that venv interpreter. Invoke
`python <skill>/scripts/render_generative.py` from the same environment.

Playwright 1.65.0 is pinned so default installations use the validated browser revision.
Keep the same browser version, OS, fonts, and rendering environment for reproducible
work. Browser frames do not require After Effects or the CEP extension, and do not
change AE scripting/security preferences.

## Scene contract

Start from `assets/generative/floating-icons/` in this skill (pip-only users can copy
[the example from the repository](https://github.com/yumehiko/ae-agent-skills/tree/main/skills/aftereffects-py-aep/assets/generative/floating-icons)), or create a scene directory containing `scene.json`, a local HTML entry, and all assets:

```json
{
  "version": 1,
  "entry": "index.html",
  "width": 640,
  "height": 360,
  "fps": "30000/1001",
  "frames": 90,
  "seed": 17,
  "alpha": true
}
```

Dimensions are 4..8192 pixels, supported rates are 1..99 fps, and duration must not exceed three hours. Use rational frame rates when needed. `frames` is the exact output count. Author
`window.renderFrame({frame, time, deltaTime, width, height, fps, frameCount, seed, random})`
to draw that exact frame, returning a promise if work is asynchronous. Frames are
zero-based and `time` is in seconds. The renderer waits for an optional
`window.sceneReady` promise before rendering. Wait for local fonts/assets there.

Frame rendering must be independent of invocation order. Derive positions and state
from `frame`/`time`, not accumulated state. The supplied seeded `random` is reset for
each frame; use it for stable procedural parameters. Do not use `Math.random`,
wall-clock time, `requestAnimationFrame`, CSS clocks, network assets, or live inputs.
CSS/Web Animations are paused and sought to the frame time after your callback. For WebGL, request a context with `preserveDrawingBuffer: true` and render explicitly. Use transparent page/canvas backgrounds for alpha scenes. Keep all assets local.
Only render trusted, locally authored code: browser isolation is not a security
boundary for arbitrary downloaded scripts. Do not place secrets in the source tree.

## Render and import

```bash
ae-generative render /absolute/scene --output /absolute/new-render
# Or from a copied skill without the ae-generative command on PATH:
python3 /absolute/skill/scripts/render_generative.py render /absolute/scene --output /absolute/new-render
```

Use a nonexistent output directory. The output contains PNG sequence frames,
`render.json` metadata with input/frame SHA-256 hashes and browser/runtime versions, and an archive of local source in `source/`. Keep these
files with the AEP: the imported footage references the sequence on disk. A failed render has no `render.json` success marker. Do not edit the archive in place: copy `source/`, edit the copy, and render to a new directory. Import verifies the hashes and rejects missing/modified frames, unexpected sequence files, and symlinks.

In the task's existing py-aep script:

```python
from pathlib import Path
import py_aep
from ae_generative.aep import import_render

app = py_aep.parse(Path('/absolute/input.aep'))
project = app.project
comp = next(c for c in project.compositions if c.name == 'Main')
import_render(project, Path('/absolute/new-render/render.json'), comp=comp, name='Generative')
# Continue native layers, transforms, effects, text, and other edits here.
project.save(Path('/absolute/new-output.aep'))
# Reparse and assert the intended composition/layer/footage result.
```

`import_render(project, render_json, *, comp=None, name='Generative')` imports sequence
footage and optionally adds it to the supplied composition. It does not save.
For a new standalone project, use
`create_project(render_json, output, ae_version='26.3x87', name='Generative')` from the same
module. Supply the actual target AE version. It saves a new AEP and reparses to check
the result. The equivalent CLI is:

```bash
ae-generative project /absolute/new-render/render.json --output /absolute/new-output.aep --ae-version '26.3x87'
```

In a skill-only Python script, add the installed skill's `scripts` directory to `sys.path` before importing
`ae_generative`, or install the full Python package normally.

## Editability and verification

The generated artwork is raster sequence pixels, not native AE vectors, text, or
shapes. Its AE layer, transform, timing, and native effects can be edited in AE;
change code and rerender to alter the artwork itself. The archived source keeps that
route reproducible. Reuse identical local inputs and the same browser/runtime;
bit-identical pixels across browser versions, OSes, fonts, or GPUs are not promised.

Review representative PNG frames and the first/last frame, verify frame count,
resolution, frame rate, alpha, and sequence timing, and reparse the new AEP. This is
an offline file/browser check only. Open the new AEP in AE and purge caches before
claiming a visual pass for the combined composition. Preserve any existing unsaved
AE work and never overwrite an input AEP or a previous render directory.

AE may quantize fractional frame rates internally (for example 30000/1001 appears as approximately 29.97003). The browser schedule remains the exact rational frame/time relationship; compare native rates/durations with a small numeric tolerance. After moving a rendered project, relink its first sequence frame or regenerate the AEP from the relocated `render.json`.

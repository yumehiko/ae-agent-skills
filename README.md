# ae-agent-skills

An offline-first After Effects workflow built on
[`py-aep`](https://github.com/forticheprod/py-aep). Version 0.14 replaces the
installed legacy declarative and mutation skills with one compact skill that edits `.aep` files as
Python object graphs.

Japanese documentation: [README.ja.md](README.ja.md)

## Install

```bash
npx --yes ae-agent-skills@latest install --agent codex
```

Replace `codex` with `gemini`, `claude`, or `all`. Restart After Effects after extension
installation and open `Window > Extensions (Beta) > ae-agent-skill` when live verification
is needed.

Example request:

```text
Use $aftereffects-py-aep to edit /path/to/input.aep, save a new
/path/to/output.aep, reparse it, and verify the intended changes.
```

The workflow:

- parses once, applies all edits in memory, and saves once;
- never overwrites the input project;
- reparses the output and checks semantic assertions;
- uses the live AE bridge only for rendering, expression diagnostics, visual bounds,
  installed fonts/effects, open-project runtime state, and independent animation checks;
- records production feedback in
  [the bundled feedback template](skills/aftereffects-py-aep/references/preview-feedback.ja.md).

The pinned py-aep 0.19.0 includes upstream fixes for the keyframe timing and easing
bugs reproduced in 0.15.1. Continue native verification, including save/reopen, before
animation signoff. See [the reproduction and exceptional fallback](skills/aftereffects-py-aep/references/keyframe-verification.md).

## Generative graphics from code

Code-authored HTML/Canvas/SVG/WebGL animation is a core feature of the existing
`aftereffects-py-aep` skill. Render local, frame-addressable code to a PNG sequence
and import it into an AEP alongside native layers, text, and effects. No additional
AE plugin is required. The result is raster footage, not AE-native shapes; edit the
archived source and rerender to change its pixels.

```bash
ae-generative render /path/to/scene --output /path/to/new-render
```

The installer creates a dedicated Python environment under
`~/.local/share/ae-agent-skills/`, including py-aep, Playwright, and Chromium. It does
not use `pip --user` or modify Homebrew/system Python packages. Python 3.10+ with
`venv` and Node.js 18+ are required. Add the launcher directory to your shell PATH:

```bash
export PATH="$HOME/.local/share/ae-agent-skills/bin:$PATH"
# Run task-specific py-aep scripts with the same managed interpreter:
"$HOME/.local/share/ae-agent-skills/bin/python" /path/to/task.py
```

The same `bin` directory provides `ae-cli` and `ae-generative`. You can call these
by their full paths without changing PATH. Close/reopen your agent after changing
PATH. Existing pip-installed CLI copies are left untouched, so put this directory
before older Python bin directories.

A failed package upgrade leaves the previous environment selected. A failed browser
download still installs the CLI and skill, but reports that browser setup is incomplete.
Retry with `ae-generative setup`, or rerun the installer with `--skip-extension`.
`--skip-cli` skips the Python environment and browser entirely. Pip/skill-only users
must create their own venv and install Chromium with that same interpreter.

Full installation and live AE verification target macOS. Linux supports the offline
Python/browser workflow with `--skip-extension`, but may need Playwright's OS libraries.
The npm installer does not support Windows. Initial setup needs network access to
GitHub, PyPI and Playwright's browser downloads; rendering uses local assets only.
Allow roughly 1 GB for a fresh environment/browser, plus PNG sequences and retained
older upgrade environments. Browser binaries are downloaded, not bundled in npm/ZXP.
See [third-party licenses](THIRD_PARTY_NOTICES.md).

Missing managed Chromium is an error; another browser is only used when explicitly
selected with `--browser`. Reproducibility requires the same browser/runtime, fonts,
and local inputs. Only execute trusted local code.

See [the generative workflow](skills/aftereffects-py-aep/references/generative-workflow.md)
for the manifest, frame API, source archive, alpha support, and py-aep import helper.

## Migration from 0.13

Version 0.14 installs `aftereffects-py-aep` in place of the previous declarative and
mutation skills. The live CLI remains available for focused runtime verification.
Task scripts and projects are not migrated or rewritten automatically.

To return to the older workflow, remove the installed `aftereffects-py-aep` skill and
install the explicit version `ae-agent-skills@0.13.0`; `latest` now uses py-aep.

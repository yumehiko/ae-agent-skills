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

## Migration from 0.13

Version 0.14 installs `aftereffects-py-aep` in place of the previous declarative and
mutation skills. The live CLI remains available for focused runtime verification.
Task scripts and projects are not migrated or rewritten automatically.

To return to the older workflow, remove the installed `aftereffects-py-aep` skill and
install the explicit version `ae-agent-skills@0.13.0`; `latest` now uses py-aep.

# ae-agent-skills — py-aep preview

This prerelease evaluates an offline-first After Effects workflow built on
[`py-aep`](https://github.com/forticheprod/py-aep). It intentionally replaces the
installed declarative and mutation skills with one compact skill that edits `.aep` files as
Python object graphs.

Japanese documentation: [README.ja.md](README.ja.md)

## Install the preview

```bash
npx --yes ae-agent-skills@pyaep install --agent codex
```

Replace `codex` with `gemini`, `claude`, or `all`. Restart After Effects after extension
installation and open `Window > Extensions (Beta) > ae-agent-skill` when live verification
is needed.

Example request:

```text
Use $aftereffects-py-aep to edit /path/to/input.aep, save a new
/path/to/output.aep, reparse it, and verify the intended changes.
```

The preview workflow:

- parses once, applies all edits in memory, and saves once;
- never overwrites the input project;
- reparses the output and checks semantic assertions;
- uses the live AE bridge only for rendering, expression diagnostics, visual bounds,
  installed fonts/effects, and open-project runtime state;
- records production feedback in
  `~/ae-agent-skills-preview/feedback-template.ja.md`.

## Return to stable

```bash
rm -rf ~/.agents/skills/aftereffects-py-aep
npx --yes ae-agent-skills@latest install --agent codex
```

Prerelease versions are published through the npm `pyaep` dist-tag and GitHub prereleases;
they do not update npm `latest`.

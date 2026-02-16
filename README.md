# ae-agent-skills

`ae-agent-skills` enables coding agents (Codex / Gemini) to operate Adobe After Effects.
It installs `ae-agent-skill` (After Effects CEP panel), `ae-cli`, and agent skills so you can ask your agent to create compositions or edit existing scenes.

Japanese README: [README.ja.md](README.ja.md)

## Quick Start

1. Install:

```bash
npx ae-agent-skills install
```

2. Restart After Effects, then open `Window > Extensions (Beta) > ae-agent-skill`.
3. Launch Codex or Gemini and ask it to perform an After Effects task.

First request example (create a composition):

```text
Use $aftereffects-declarative to create a 1920x1080, 30fps, 5-second composition.
Set a dark gray background, place "Hello AE Agent" text at the center,
and add a 0.5-second fade-in animation.
```

4. After the agent finishes, confirm the composition is created in After Effects.

## What the installer does

1. Prompts for target agent (`codex` / `gemini` / `both`) when `--agent` is omitted.
2. Installs the signed ZXP extension via `UPIA` or `ExManCmd`.
3. Installs `ae-cli` and agent skills.
4. Initializes `~/ae-agent-skills/` with `work/`, `done/`, `scene.schema.json`, and `references/`.

## Which skill to use

- `$aftereffects-declarative`: default for new composition building and overall scene structure
- `$aftereffects-cli`: best for surgical edits, property-level tweaks, and debugging

## Docs

- CLI usage: [docs/cli.md](docs/cli.md)
- Development: [docs/development.md](docs/development.md)
- Known reverse-conversion limitations (v0.3 plan): [docs/reverse-scene-limitations.md](docs/reverse-scene-limitations.md)
- Declarative skill source: [.codex/skills/aftereffects-declarative/SKILL.md](.codex/skills/aftereffects-declarative/SKILL.md)
- Legacy CLI skill source: [.codex/skills/aftereffects-cli/SKILL.md](.codex/skills/aftereffects-cli/SKILL.md)

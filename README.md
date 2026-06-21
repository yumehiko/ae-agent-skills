# ae-agent-skills

`ae-agent-skills` enables coding agents (Codex / Gemini / Claude Code) to operate Adobe After Effects.
It installs `ae-agent-skill` (After Effects CEP panel), `ae-cli`, and agent skills so you can ask your agent to create compositions or edit existing scenes.

Japanese README: [README.ja.md](README.ja.md)

## Quick Start

1. Install:

```bash
npx ae-agent-skills install
```

2. Restart After Effects, then open `Window > Extensions (Beta) > ae-agent-skill`.
3. Launch Codex, Gemini, or Claude Code and ask it to perform an After Effects task.

First request example (create a composition):

```text
Use $aftereffects-declarative to create a 1920x1080, 30fps, 5-second composition.
Set a dark gray background, place "Hello AE Agent" text at the center,
and add a 0.5-second fade-in animation.
```

In Claude Code, invoke the skill as a slash command:

```text
Use /aftereffects-declarative to create a 1920x1080, 30fps, 5-second composition.
Set a dark gray background, place "Hello AE Agent" text at the center,
and add a 0.5-second fade-in animation.
```

4. After the agent finishes, confirm the composition is created in After Effects.

To choose an agent explicitly:

```bash
npx ae-agent-skills install --agent codex
npx ae-agent-skills install --agent gemini
npx ae-agent-skills install --agent claude
npx ae-agent-skills install --agent all
```

## What the installer does

1. Prompts for target agent (`codex` / `gemini` / `claude` / `both` / `all`) when `--agent` is omitted.
2. Installs the signed ZXP extension via `UPIA` or `ExManCmd`.
3. Installs `ae-cli` and agent skills.
4. Initializes `~/ae-agent-skills/` with `work/`, `done/`, `scene.schema.json`, and `references/`.

`both` means Codex + Gemini for backward compatibility. `all` means Codex + Gemini + Claude Code.
Claude Code user skills are installed under `~/.claude/skills/<skill-name>/SKILL.md`.
Claude Code slash commands are installed under `~/.claude/commands/<command>.md`.

## Which skill to use

- `$aftereffects-declarative`: default for new composition building and overall scene structure
- `$aftereffects-cli`: best for surgical edits, property-level tweaks, and debugging

## Docs

- CLI usage: [docs/cli.md](docs/cli.md)
- Development: [docs/development.md](docs/development.md)
- Declarative skill source: [templates/skills/aftereffects-declarative.SKILL.md](templates/skills/aftereffects-declarative.SKILL.md)
- CLI skill source: [templates/skills/aftereffects-cli.SKILL.md](templates/skills/aftereffects-cli.SKILL.md)

# ae-agent-skills

`ae-agent-skills` lets Codex, Gemini, and Claude Code operate Adobe After Effects.
It installs the After Effects extension, `ae-cli`, and agent skills with one command.

日本語: [README.ja.md](README.ja.md)

## Quick Start

1. Install:

```bash
npx ae-agent-skills install
```

2. Restart After Effects and open `Window > Extensions (Beta) > ae-agent-skill`.
3. Launch your agent and ask it to perform an After Effects task.

```text
Use $aftereffects-declarative to create a 1920x1080, 30fps, 5-second composition.
Set a dark gray background, place "Hello AE Agent" text at the center,
and add a 0.5-second fade-in animation.
```

In Claude Code, use `/aftereffects-declarative` instead of `$aftereffects-declarative`.

## Choosing a skill

- `$aftereffects-declarative`: The default for new compositions and repeatable scene-level edits.
- `$aftereffects-cli`: For focused adjustments to existing scenes and debugging.

## Updating

Quit After Effects, then run the installer for the agent you previously installed:

```bash
npx --yes ae-agent-skills@latest install --agent codex
```

Replace `codex` with `gemini`, `claude`, or `all` as needed. Restart After Effects when it finishes.

## Documentation

- [CLI usage](docs/cli.md)
- [Development](docs/development.md)

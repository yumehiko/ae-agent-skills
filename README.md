# ae-agent-skills

One-command installer for `ae-agent-skill` (After Effects CEP panel), `ae-cli`, and Codex/Gemini skills.

Japanese README: [README.ja.md](README.ja.md)

## Install (No clone)

```bash
npx ae-agent-skills install
```

What happens:

1. The installer asks which agent to configure (`codex` / `gemini` / `both`) if `--agent` is omitted.
2. It installs the signed ZXP extension via `UPIA` or `ExManCmd`.
3. It installs `ae-cli` and agent skills.

## Run with your agent

After installation:

1. Restart After Effects.
2. Open `Window > Extensions (Beta) > ae-agent-skill`.
3. Run your coding agent and call one of these skills:
- `$aftereffects-declarative` for normal composition building.
- `$aftereffects-cli` for command-by-command edits/debug.

## Docs

- CLI usage: [docs/cli.md](docs/cli.md)
- Development: [docs/development.md](docs/development.md)
- Declarative skill source: [.codex/skills/aftereffects-declarative/SKILL.md](.codex/skills/aftereffects-declarative/SKILL.md)
- Legacy CLI skill source: [.codex/skills/aftereffects-cli/SKILL.md](.codex/skills/aftereffects-cli/SKILL.md)

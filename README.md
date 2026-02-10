# ae-agent-skills

Simple MCP-free tooling to control an After Effects CEP HTTP bridge.

Japanese README is available at [README.ja.md](README.ja.md).

## Quick Links

- English README: [README.md](README.md)
- Japanese README: [README.ja.md](README.ja.md)
- Onboarding skill: [.codex/skills/aftereffects-onboarding/SKILL.md](.codex/skills/aftereffects-onboarding/SKILL.md)
- CLI skill: [.codex/skills/aftereffects-cli/SKILL.md](.codex/skills/aftereffects-cli/SKILL.md)

## What this repo includes

- `ae-cli` for:
  - listing layers/properties
  - applying expressions
  - adding effects
- Agent skills for Codex/Gemini workflows:
  - `.codex/skills/aftereffects-cli/SKILL.md`
  - `.codex/skills/aftereffects-onboarding/SKILL.md`

## Requirements

- macOS
- Adobe After Effects (CEP-capable environment)
- Python 3.10+

## Quick Start (Recommended)

Use an agent and ask it to run onboarding for this repository.

Example prompts:

- `Please run aftereffects-onboarding for this repository.`
- `このリポジトリで aftereffects-onboarding を進めて。`

The onboarding flow covers:

- CEP extension placement/linking
- Python virtual environment setup
- `pip install -e .`
- bridge connectivity checks (`ae-cli health`, `ae-cli layers`)

## Clone

```bash
git clone https://github.com/yumehiko/ae-agent-skills.git
cd ae-agent-skills
```

## Manual CLI usage

```bash
ae-cli --help
ae-cli health
ae-cli layers
ae-cli selected-properties
ae-cli properties --layer-id 1 --max-depth 3
ae-cli set-expression --layer-id 1 --property-path "Transform > Position" --expression "wiggle(2,30)"
ae-cli add-effect --layer-id 1 --effect-match-name "ADBE Slider Control" --effect-name "Speed"
```

If `ae-cli` is not on your `PATH`, run it with:

```bash
PYTHONPATH=src python3 -m ae_cli.main --help
```

By default, the CLI uses `AE_BRIDGE_URL` or falls back to `http://127.0.0.1:8080`.

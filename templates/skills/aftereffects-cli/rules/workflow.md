---
name: workflow
description: Baseline imperative workflow for safe AE command execution
---

## References

- Schema: `~/ae-agent-skills/scene.schema.json`
- Example scene: `~/ae-agent-skills/references/scene.example.json`
- CLI reference (JA): `~/ae-agent-skills/references/cli.ja.md`
- CLI reference (EN): `~/ae-agent-skills/references/cli.md`

## Standard flow

1. Check connectivity: `ae-cli health`
2. Inspect state:
   - `ae-cli list-comps`
   - `ae-cli layers`
   - `ae-cli selected-properties`
   - `ae-cli expression-errors`
3. Execute the minimum command set to achieve the change.
4. Verify result immediately with `layers` / `properties`.

## Working directory convention

- Use `~/ae-agent-skills/work/` for temporary scene files.
- Move finished artifacts to `~/ae-agent-skills/done/`.


---
name: scene-json
description: Core declarative scene JSON workflow for ae-cli apply-scene
---

## Goal

Build and maintain a complete scene description that can be validated and re-applied safely.

## References

- Schema: `~/ae-agent-skills/scene.schema.json`
- Example scene: `~/ae-agent-skills/references/scene.example.json`
- CLI reference (JA): `~/ae-agent-skills/references/cli.ja.md`
- CLI reference (EN): `~/ae-agent-skills/references/cli.md`

## File locations

- Work in progress: `~/ae-agent-skills/work/`
- Final snapshot: `~/ae-agent-skills/done/`

## Standard flow

1. `ae-cli health`
2. Create or update scene JSON in `~/ae-agent-skills/work/`
3. Validate:
   `ae-cli apply-scene --scene-file <scene.json> --validate-only`
4. Apply:
   `ae-cli apply-scene --scene-file <scene.json>`
5. Verify with:
   - `ae-cli layers`
   - `ae-cli properties --layer-name <name> --include-group <group> --include-group-children`
   - `ae-cli expression-errors`
6. Copy final JSON to `~/ae-agent-skills/done/`

## Design rules

- Use stable `layers[].id` for upsert behavior.
- Use `parentId` based on scene IDs, not layer display names.
- Keep animations in `animations`.
- Keep expressions in `expressions`.
- Keep effect parameters in `effects[].params[]`.
- Keep repeater config in `repeaters[]`.


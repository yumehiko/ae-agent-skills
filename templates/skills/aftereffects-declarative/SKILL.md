---
name: aftereffects-declarative
description: Primary After Effects workflow using ae-cli apply-scene with declarative JSON (composition, layers, animations, expressions, parent, repeater, and effect params). Use this by default for composition building.
---

# aftereffects-declarative

Use this skill for new builds and repeatable edits driven by scene JSON.

## When to use

- Building a new composition or a full layer stack
- Applying the same change pattern to multiple layers
- Preserving work as a re-runnable artifact
- Managing layers through stable `layers[].id`

## When not to use

- Surgical edits on unmanaged, human-made scenes
- One-off probing and debugging on existing projects
- Cases where a full declarative re-application is unnecessary

For those cases, use `$aftereffects-cli`.

## Hard requirements

- MUST run `ae-cli health` before starting changes.
- MUST treat `~/ae-agent-skills/scene.schema.json` as the source of truth.
- MUST run `--validate-only` before applying, unless the user explicitly asks to skip.
- MUST confirm `propertyPath` via `ae-cli properties`; never guess.
- NEVER invent schema keys or rely on display names when matchName paths are available.

## Rule map

- Scene structure and file workflow: [`rules/scene-json.md`](rules/scene-json.md)
- Apply modes (`merge`, `replace-managed`, `clear-all`): [`rules/apply-modes.md`](rules/apply-modes.md)
- Property paths and expressions: [`rules/propertypath.md`](rules/propertypath.md)
- Validation and troubleshooting: [`rules/debugging.md`](rules/debugging.md)
- Permission/escalation policy with yumehiko: [`rules/escalation.md`](rules/escalation.md)


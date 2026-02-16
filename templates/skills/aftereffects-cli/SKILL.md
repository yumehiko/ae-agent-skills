---
name: aftereffects-cli
description: Command-by-command After Effects editing via ae-cli. Best for surgical edits on existing human-made scenes, partial expression/property changes, and debugging.
---

# aftereffects-cli

Use this skill for imperative, low-level updates in existing projects.

## When to use

- Surgical changes on human-made scenes not managed by scene JSON
- Property-level or expression-level fixes on specific layers
- One-off inspection and debugging tasks
- Declarative workflow gaps that need direct commands

## When not to use

- Building a full composition from scratch
- Repeating the same edits across many layers
- Cases requiring a durable, re-runnable artifact

For those cases, use `$aftereffects-declarative`.

## Hard requirements

- MUST run `ae-cli health` before edits.
- MUST inspect current state before mutating layers.
- MUST keep edits minimal and verify after each mutation.
- NEVER perform broad destructive operations when a surgical command can solve it.

## Rule map

- Baseline workflow: [`rules/workflow.md`](rules/workflow.md)
- Common command groups: [`rules/commands.md`](rules/commands.md)
- Switching threshold to declarative workflow: [`rules/switch-to-declarative.md`](rules/switch-to-declarative.md)
- Debugging loop: [`rules/debugging.md`](rules/debugging.md)
- Permission/escalation policy with yumehiko: [`rules/escalation.md`](rules/escalation.md)


---
name: debugging
description: Debugging loop for command-by-command AE edits
---

## Loop

1. Run target mutation command(s).
2. Verify structural changes:
   `ae-cli layers`
3. Verify property details:
   `ae-cli properties --layer-name <name> --include-group <group> --include-group-children`
4. Verify expressions:
   `ae-cli expression-errors`
5. Adjust and re-run.

## Guidance

- Keep each mutation step small.
- Prefer observation commands before further mutation.
- If command count and complexity keep growing, move to declarative workflow.


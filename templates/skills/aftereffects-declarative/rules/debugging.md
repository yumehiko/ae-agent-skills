---
name: debugging
description: Validation and troubleshooting loop for declarative AE edits
---

## Standard debugging loop

1. Validate:
   `ae-cli apply-scene --scene-file <scene.json> --validate-only`
2. Apply:
   `ae-cli apply-scene --scene-file <scene.json>`
3. Check expression failures:
   `ae-cli expression-errors`
4. Inspect target layer paths:
   `ae-cli properties --layer-name <name> --include-group <group> --include-group-children`
5. Re-run from step 1.

## Common failures

- Validation error:
  Schema mismatch or type mismatch in scene JSON.
- Expression error:
  Wrong property path or wrong effect reference.
- Unexpected new layers:
  Missing or changed `layers[].id`.
- Old layers not removed:
  Wrong apply mode (try `replace-managed`).


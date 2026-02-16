---
name: apply-modes
description: How to choose ae-cli apply-scene modes safely
---

## Modes

- `merge` (default): Keep existing content and upsert only declared items.
- `replace-managed`: Replace only layers tagged as managed (`aeSceneId:*`).
- `clear-all`: Remove all layers in target comp, then rebuild from JSON.

## Selection guide

- Use `merge` for additive updates and low-risk iterations.
- Use `replace-managed` when stale managed layers must be removed cleanly.
- Use `clear-all` only when full reset is intentional and approved.

## Commands

```bash
ae-cli apply-scene --scene-file <scene.json>
ae-cli apply-scene --scene-file <scene.json> --mode replace-managed
ae-cli apply-scene --scene-file <scene.json> --mode clear-all
```

## Safety checks

- Always run `--validate-only` first.
- If unexpected duplication appears, check whether `layers[].id` changed or is missing.
- If old managed layers persist, switch from `merge` to `replace-managed`.


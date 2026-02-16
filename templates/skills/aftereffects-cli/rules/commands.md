---
name: commands
description: Common command groups for imperative AE operations
---

## Composition commands

- `ae-cli create-comp`
- `ae-cli set-active-comp`
- `ae-cli delete-comp`

## Layer and property commands

- `ae-cli add-layer`
- `ae-cli set-property`
- `ae-cli set-keyframe`
- `ae-cli set-expression`
- `ae-cli add-effect`
- `ae-cli add-essential-property`
- `ae-cli add-shape-repeater`

## Timeline commands

- `ae-cli set-in-out-point`
- `ae-cli move-layer-time`
- `ae-cli set-cti`
- `ae-cli set-work-area`

## Structure commands

- `ae-cli parent-layer`
- `ae-cli precompose`
- `ae-cli duplicate-layer`
- `ae-cli move-layer-order`
- `ae-cli delete-layer`

## Minimal smoke test

```bash
ae-cli health
ae-cli create-comp --name "Skill_CLI_Minimal_Test" --width 1280 --height 720 --duration 3 --frame-rate 30
ae-cli set-active-comp --comp-name "Skill_CLI_Minimal_Test"
ae-cli add-layer --type text --name "Hello" --text "CLI skill test"
ae-cli layers
```


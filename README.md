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
  - adding layers
  - timeline operations (`set-in-out-point`, `move-layer-time`, `set-cti`, `set-work-area`)
  - layer structure operations (`parent-layer`, `precompose`, `duplicate-layer`, `move-layer-order`, `delete-layer`, `delete-comp`)
- Agent skills for Codex/Gemini workflows:
  - `.codex/skills/aftereffects-cli/SKILL.md`
  - `.codex/skills/aftereffects-onboarding/SKILL.md`

## Requirements

- macOS
- Adobe After Effects (CEP-capable environment)
- Python 3.10+

### CEP Debug Setting (for unsigned extensions)

This extension is intended for development use, so some environments require `PlayerDebugMode=1`.

```bash
defaults domains | tr ',' '\n' | rg 'com\.adobe\.CSXS\.'
# Example: if com.adobe.CSXS.11 exists
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

After setting it, fully quit and relaunch After Effects.

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
ae-cli list-comps
ae-cli create-comp --name "Main" --width 1920 --height 1080 --duration 8 --frame-rate 30
ae-cli set-active-comp --comp-name "Main"
ae-cli selected-properties
ae-cli properties --layer-name "Title" --include-group "ADBE Effect Parade" --include-group-children --time 2.0
ae-cli set-expression --layer-name "Title" --property-path "Transform > Position" --expression "wiggle(2,30)"
ae-cli set-property --layer-id 1 --property-path "ADBE Transform Group.ADBE Position" --value "[960,540]"
ae-cli set-keyframe --layer-id 1 --property-path "ADBE Transform Group.ADBE Position" --time 0.5 --value "[960,540]"
ae-cli set-keyframe --layer-id 1 --property-path "ADBE Transform Group.ADBE Position" --time 1.0 --value "[960,300]" --in-interp bezier --out-interp bezier --ease-in "[0,80]" --ease-out "[0,40]"
ae-cli add-effect --layer-id 1 --effect-match-name "ADBE Slider Control" --effect-name "Speed"
ae-cli add-layer --layer-type text --name "Title" --text "Hello from CLI"
ae-cli add-layer --layer-type solid --name "BG" --width 1920 --height 1080 --color 32 64 128 --duration 10
ae-cli add-layer --layer-type shape --name "BurstCircle" --shape-type ellipse --shape-size 720 720 --shape-fill-color 255 128 0 --shape-stroke-color 255 255 255 --shape-stroke-width 8
ae-cli add-shape-repeater --layer-name "BurstCircle" --group-index 1 --copies 12 --rotation 30 --end-opacity 0
ae-cli set-in-out-point --layer-name "Title" --in-point 0.5 --out-point 6.5
ae-cli move-layer-time --layer-name "Title" --delta 0.25
ae-cli set-cti --time 2.0
ae-cli set-work-area --start 1.0 --duration 4.0
ae-cli parent-layer --child-layer-id 2 --parent-layer-id 1
ae-cli parent-layer --child-layer-id 2 --clear-parent
ae-cli precompose --layer-id 3 --layer-id 2 --name "Shot_A" --move-all-attributes
ae-cli duplicate-layer --layer-id 1
ae-cli move-layer-order --layer-id 4 --to-top
ae-cli move-layer-order --layer-id 4 --before-layer-id 2
ae-cli delete-layer --layer-id 4
ae-cli delete-comp --comp-name "Shot_A"
```

If `ae-cli` is not on your `PATH`, run it with:

```bash
PYTHONPATH=src python3 -m ae_cli.main --help
```

By default, the CLI uses `AE_BRIDGE_URL` or falls back to `http://127.0.0.1:8080`.

## Development

Install dev dependencies:

```bash
python3 -m pip install -e ".[dev]"
```

Run tests:

```bash
PYTHONPATH=src pytest
```

### Python CLI structure

- `src/ae_cli/cli_parser.py`: argument parser and command definitions
- `src/ae_cli/cli_runner.py`: command dispatch and error handling
- `src/ae_cli/client.py`: HTTP client to the CEP bridge
- `src/ae_cli/main.py`: thin entrypoint (`ae-cli`)

### ExtendScript host structure

- `host/index.jsx`: module loader entrypoint
- `host/lib/common.jsx`: logging/json bootstrap/common helpers
- `host/lib/property_utils.jsx`: shared property-tree helpers
- `host/lib/query_handlers.jsx`: read-only handlers (`getLayers`, `getProperties`, `getSelectedProperties`)
- `host/lib/mutation_handlers.jsx`: write handlers core (`setExpression`, `addEffect`, `setPropertyValue`, `setKeyframe`, `createComp`, `setActiveComp`)
- `host/lib/mutation_shape_handlers.jsx`: shape write handlers (`addLayer`, `addShapeRepeater`)
- `host/lib/mutation_timeline_handlers.jsx`: timeline handlers (`setInOutPoint`, `moveLayerTime`, `setCTI`, `setWorkArea`)
- `host/lib/mutation_layer_structure_handlers.jsx`: layer structure handlers (`parentLayer`, `precomposeLayers`, `duplicateLayer`, `moveLayerOrder`, `deleteLayer`, `deleteComp`)

### CEP panel client structure

- `client/main.js`: startup entrypoint
- `client/lib/runtime.js`: CEP/Node bootstrap and host script evaluation
- `client/lib/logging.js`: panel log output helpers
- `client/lib/bridge_utils.js`: JSON/body parsing and bridge response helpers
- `client/lib/request_handlers_shape.js`: shape-specific request handlers (`addLayer`, `addShapeRepeater`)
- `client/lib/request_handlers.js`: route dispatch and endpoint handlers
- `client/lib/server.js`: HTTP server lifecycle

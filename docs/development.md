# Development

## Local dev requirements

- macOS
- Adobe After Effects (CEP-capable)
- Python 3.10+

## Unsigned local dev mode

For local unsigned extension workflows, enable `PlayerDebugMode=1`:

```bash
defaults domains | tr ',' '\n' | rg 'com\.adobe\.CSXS\.'
# Example for com.adobe.CSXS.11
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

Then fully quit and relaunch After Effects.

## Python dev setup

```bash
python3 -m pip install -e ".[dev]"
PYTHONPATH=src pytest
```

## Project structure

### Python CLI

- `src/ae_cli/cli_parser.py`
- `src/ae_cli/cli_runner.py`
- `src/ae_cli/client.py`
- `src/ae_cli/main.py`

### ExtendScript host

- `host/index.jsx`
- `host/lib/common.jsx`
- `host/lib/property_utils.jsx`
- `host/lib/query_common.jsx`
- `host/lib/query_layers_handlers.jsx`
- `host/lib/query_properties_handlers.jsx`
- `host/lib/query_expressions_handlers.jsx`
- `host/lib/query_animations_handlers.jsx`
- `host/lib/query_effects_handlers.jsx`
- `host/lib/mutation_handlers.jsx`
- `host/lib/mutation_keyframe_handlers.jsx`
- `host/lib/mutation_shape_handlers.jsx`
- `host/lib/mutation_timeline_handlers.jsx`
- `host/lib/mutation_layer_structure_handlers.jsx`
- `host/lib/mutation_scene_handlers.jsx`

### CEP panel client

- `client/main.js`
- `client/lib/runtime.js`
- `client/lib/logging.js`
- `client/lib/bridge_utils.js`
- `client/lib/request_handlers_shape.js`
- `client/lib/request_handlers_scene.js`
- `client/lib/request_handlers_essential.js`
- `client/lib/request_handlers_timeline.js`
- `client/lib/request_handlers_layer_structure.js`
- `client/lib/request_handlers.js`
- `client/lib/server.js`

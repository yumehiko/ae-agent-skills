# 開発者向け情報

## ローカル開発の前提

- macOS
- Adobe After Effects（CEP対応環境）
- Python 3.10+

## 未署名ローカル開発モード

未署名拡張で開発する場合は `PlayerDebugMode=1` を有効化します。

```bash
defaults domains | tr ',' '\n' | rg 'com\.adobe\.CSXS\.'
# 例: com.adobe.CSXS.11 の場合
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

設定後は After Effects を完全終了して再起動してください。

## Python開発セットアップ

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
PYTHONPATH=src python -m pytest
npm run test:node
```

## プロジェクト構成

### Python CLI

- `src/ae_cli/cli_parser.py`
- `src/ae_cli/cli_runner.py`
- `src/ae_cli/client.py`
- `src/ae_cli/main.py`

### ExtendScript host

- `host/index.jsx`
- `host/lib/common.jsx`
- `host/lib/property_utils.jsx`
- `host/lib/query_handlers.jsx`
- `host/lib/footage_handlers.jsx`
- `host/lib/audio_handlers.jsx`
- `host/lib/text_handlers.jsx`
- `host/lib/layout_handlers.jsx`
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
- `client/lib/request_handlers_footage.js`
- `client/lib/request_handlers_audio.js`
- `client/lib/request_handlers_text.js`
- `client/lib/request_handlers_layout.js`
- `client/lib/request_handlers_scene.js`
- `client/lib/request_handlers_essential.js`
- `client/lib/request_handlers_timeline.js`
- `client/lib/request_handlers_layer_structure.js`
- `client/lib/request_handlers.js`
- `client/lib/server.js`

## ジェネラティブruntime

正規ソースは `skills/aftereffects-py-aep/scripts/ae_generative/` にあります。
setuptoolsは `src/ae_cli/` と一緒にパッケージ化し、npmは同じソースと
`scripts/render_generative.py` をスキルに同梱します。二重実装は作らないでください。
ブラウザのsmoke test前には、同じPython環境でChromiumを導入してください。

```bash
python -m playwright install chromium
ae-generative --help
AE_GENERATIVE_BROWSER_TESTS=1 PYTHONPATH=src python -m pytest -q
```

[Generative workflow](../skills/aftereffects-py-aep/references/generative-workflow.md)

# ae-agent-skills

After Effects の CEP HTTP ブリッジを、MCP 非依存で操作するためのリポジトリです。

English README は [README.md](README.md) を参照してください。

## Quick Links

- English README: [README.md](README.md)
- 日本語 README: [README.ja.md](README.ja.md)
- Onboarding skill: [.codex/skills/aftereffects-onboarding/SKILL.md](.codex/skills/aftereffects-onboarding/SKILL.md)
- CLI skill: [.codex/skills/aftereffects-cli/SKILL.md](.codex/skills/aftereffects-cli/SKILL.md)

## このリポジトリでできること

- `ae-cli` で以下を実行
  - レイヤー/プロパティ取得
  - expression 適用
  - エフェクト追加
  - レイヤー追加
  - タイムライン操作（`set-in-out-point`, `move-layer-time`, `set-cti`, `set-work-area`）
  - レイヤー構造操作（`parent-layer`, `precompose`, `duplicate-layer`, `move-layer-order`, `delete-layer`, `delete-comp`）
- Codex/Gemini 向け skill を同梱
  - `.codex/skills/aftereffects-cli/SKILL.md`
  - `.codex/skills/aftereffects-onboarding/SKILL.md`

## 前提

- macOS
- Adobe After Effects（CEP 拡張が動作する環境）
- Python 3.10+

### CEP Debug 設定（未署名拡張向け）

このリポジトリの拡張は開発用途を想定しているため、環境によっては `PlayerDebugMode=1` が必要です。

```bash
defaults domains | tr ',' '\n' | rg 'com\.adobe\.CSXS\.'
# 例: com.adobe.CSXS.11 が見つかった場合
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

設定後は After Effects を完全終了して再起動してください。

## クイックスタート（推奨）

エージェントに onboarding を依頼してください。

依頼例:

- `このリポジトリで aftereffects-onboarding を進めて。`
- `Please run aftereffects-onboarding for this repository.`

onboarding では次を段階的に確認します。

- CEP extension の配置/リンク
- Python 仮想環境構築
- `pip install -e .`
- ブリッジ疎通確認（`ae-cli health`, `ae-cli layers`）

## クローン

```bash
git clone https://github.com/yumehiko/ae-agent-skills.git
cd ae-agent-skills
```

## 手動で CLI を使う場合

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

`ae-cli` が `PATH` にない場合は、次で実行できます。

```bash
PYTHONPATH=src python3 -m ae_cli.main --help
```

`--base-url` 未指定時は `AE_BRIDGE_URL`、なければ `http://127.0.0.1:8080` を使用します。

## 開発向け

開発用依存を入れる:

```bash
python3 -m pip install -e ".[dev]"
```

テスト実行:

```bash
PYTHONPATH=src pytest
```

### Python CLI の構成

- `src/ae_cli/cli_parser.py`: 引数定義とコマンド定義
- `src/ae_cli/cli_runner.py`: コマンドディスパッチとエラーハンドリング
- `src/ae_cli/client.py`: CEP ブリッジへの HTTP クライアント
- `src/ae_cli/main.py`: エントリポイント（`ae-cli`）

### ExtendScript host の構成

- `host/index.jsx`: モジュールローダー（エントリポイント）
- `host/lib/common.jsx`: ログ出力・JSON 初期化・共通ヘルパー
- `host/lib/property_utils.jsx`: プロパティ探索の共通ヘルパー
- `host/lib/query_handlers.jsx`: 読み取り系ハンドラ（`getLayers`, `getProperties`, `getSelectedProperties`）
- `host/lib/mutation_handlers.jsx`: 更新系ハンドラ（コア: `setExpression`, `addEffect`, `setPropertyValue`, `setKeyframe`, `createComp`, `setActiveComp`）
- `host/lib/mutation_shape_handlers.jsx`: shape 系ハンドラ（`addLayer`, `addShapeRepeater`）
- `host/lib/mutation_timeline_handlers.jsx`: タイムライン操作ハンドラ（`setInOutPoint`, `moveLayerTime`, `setCTI`, `setWorkArea`）
- `host/lib/mutation_layer_structure_handlers.jsx`: レイヤー構造操作ハンドラ（`parentLayer`, `precomposeLayers`, `duplicateLayer`, `moveLayerOrder`, `deleteLayer`, `deleteComp`）

### CEP パネル client の構成

- `client/main.js`: 起動エントリポイント
- `client/lib/runtime.js`: CEP/Node 初期化と host script 呼び出し
- `client/lib/logging.js`: パネルログ出力ヘルパー
- `client/lib/bridge_utils.js`: JSON/body 解析と bridge 応答ヘルパー
- `client/lib/request_handlers_shape.js`: shape 系リクエストハンドラ（`addLayer`, `addShapeRepeater`）
- `client/lib/request_handlers.js`: ルーティングとエンドポイントハンドラ
- `client/lib/server.js`: HTTP サーバーの起動/エラーハンドリング

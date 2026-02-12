# ae-agent-skills

After Effects の CEP HTTP ブリッジを、MCP 非依存で操作するためのリポジトリです。

English README は [README.md](README.md) を参照してください。

## Quick Links

- English README: [README.md](README.md)
- 日本語 README: [README.ja.md](README.ja.md)
- Onboarding skill: [.codex/skills/aftereffects-onboarding/SKILL.md](.codex/skills/aftereffects-onboarding/SKILL.md)
- 宣言型 skill: [.codex/skills/aftereffects-declarative/SKILL.md](.codex/skills/aftereffects-declarative/SKILL.md)
- レガシー CLI skill: [.codex/skills/aftereffects-cli/SKILL.md](.codex/skills/aftereffects-cli/SKILL.md)

## このリポジトリでできること

- `ae-cli` で以下を実行
  - レイヤー/プロパティ取得
  - expression エラー診断（`expression-errors`）
  - expression 適用
  - エフェクト追加
  - Essential Graphics プロパティ追加
  - レイヤー追加
  - 宣言的シーン適用（`apply-scene`）
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
ae-cli expression-errors
ae-cli properties --layer-name "Title" --include-group "ADBE Effect Parade" --include-group-children --time 2.0
ae-cli set-expression --layer-name "Title" --property-path "Transform > Position" --expression "wiggle(2,30)"
ae-cli set-property --layer-id 1 --property-path "ADBE Transform Group.ADBE Position" --value "[960,540]"
ae-cli set-keyframe --layer-id 1 --property-path "ADBE Transform Group.ADBE Position" --time 0.5 --value "[960,540]"
ae-cli set-keyframe --layer-id 1 --property-path "ADBE Transform Group.ADBE Position" --time 1.0 --value "[960,300]" --in-interp bezier --out-interp bezier --ease-in "[0,80]" --ease-out "[0,40]"
ae-cli add-essential-property --layer-name "Title" --property-path "ADBE Text Properties.ADBE Text Document" --essential-name "Search Word"
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
ae-cli apply-scene --scene-file examples/scene.example.json --validate-only
ae-cli apply-scene --scene-file examples/scene.example.json
ae-cli apply-scene --scene-file examples/scene.example.json --mode replace-managed
ae-cli apply-scene --scene-file examples/scene.example.json --mode clear-all
```

`ae-cli` が `PATH` にない場合は、次で実行できます。

```bash
PYTHONPATH=src python3 -m ae_cli.main --help
```

`--base-url` 未指定時は `AE_BRIDGE_URL`、なければ `http://127.0.0.1:8080` を使用します。

### 宣言的 Scene JSON（`apply-scene`）

1つの JSON で comp/layer 構成を一括適用できます。

```bash
ae-cli apply-scene --scene-file examples/scene.example.json --validate-only
ae-cli apply-scene --scene-file examples/scene.example.json
ae-cli apply-scene --scene-file examples/scene.example.json --mode replace-managed
ae-cli apply-scene --scene-file examples/scene.example.json --mode clear-all
```

スキーマ参照:

- `schemas/scene.schema.json`

最小構成の例:

```json
{
  "composition": {
    "name": "Main",
    "width": 1920,
    "height": 1080,
    "duration": 8,
    "frameRate": 30
  },
  "layers": [
    {
      "id": "title",
      "type": "text",
      "name": "Title",
      "text": "Hello Agent",
      "transform": { "position": [960, 540] },
      "animations": [
        {
          "propertyPath": "ADBE Transform Group.ADBE Position",
          "keyframes": [
            { "time": 0, "value": [960, 700] },
            { "time": 1, "value": [960, 540], "inInterp": "bezier", "easeIn": [0, 80] }
          ]
        }
      ]
    }
  ]
}
```

主なトップレベル項目:

- `composition`: 対象 comp の指定/作成設定（`compId`, `compName`, `name`, `width`, `height`, `duration`, `frameRate`, `pixelAspect`, `createIfMissing`, `setActive`）
- `layers[]`: レイヤー定義（`type`, `name`, `text`, shape/solid オプション, `timing`, `transform`, `propertyValues`, `effects`, `animations`）
- `layers[].id`: upsert 再利用用の安定ID。既存IDが見つかった場合は新規作成せず、そのレイヤーを更新します。
- `layers[].parentId`: scene id を使った親子定義（`null` 指定で親解除）
- `layers[].expressions[]`: expression 定義（`propertyPath`, `expression`）
- `layers[].essentialProperties[]`: Essential Graphics 追加（`propertyPath`, 任意で `essentialName`）
- `layers[].repeaters[]`: shape の Repeater 定義（`add-shape-repeater` 相当オプション）
- `layers[].effects[].params[]`: effect パラメータ設定（`propertyPath` / `matchName` / `propertyIndex` のいずれか + `value`）
- 3D ベクトル系プロパティに対しては、`[x, y]` の2次元入力を `[x, y, 0]` として自動補完します。

`apply-scene` の mode:

- `merge`（デフォルト）: upsert のみ。宣言したレイヤーは更新/作成、未宣言レイヤーは保持。
- `replace-managed`: 現在の scene に含まれない管理対象レイヤー（`aeSceneId:*`）だけ削除してから適用。
- `clear-all`: 対象 comp の全レイヤーを削除してから適用。

expression の移植性メモ:

- effect パラメータ参照は、表示名（例: `(\"Slider\")`）よりも matchName（例: `(\"ADBE Slider Control-0001\")`）を優先する。

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
- `host/lib/query_handlers.jsx`: 読み取り系ハンドラ（`getLayers`, `getProperties`, `getSelectedProperties`, `getExpressionErrors`）
- `host/lib/mutation_handlers.jsx`: 更新系ハンドラ（コア: `setExpression`, `addEffect`, `addEssentialProperty`, `setPropertyValue`, `createComp`, `setActiveComp`）
- `host/lib/mutation_keyframe_handlers.jsx`: キーフレーム系ハンドラ（`setKeyframe`）と補間/ease ヘルパー
- `host/lib/mutation_shape_handlers.jsx`: shape 系ハンドラ（`addLayer`, `addShapeRepeater`）
- `host/lib/mutation_timeline_handlers.jsx`: タイムライン操作ハンドラ（`setInOutPoint`, `moveLayerTime`, `setCTI`, `setWorkArea`）
- `host/lib/mutation_layer_structure_handlers.jsx`: レイヤー構造操作ハンドラ（`parentLayer`, `precomposeLayers`, `duplicateLayer`, `moveLayerOrder`, `deleteLayer`, `deleteComp`）
- `host/lib/mutation_scene_handlers.jsx`: 宣言的 scene 一括適用ハンドラ（`applyScene`）

### CEP パネル client の構成

- `client/main.js`: 起動エントリポイント
- `client/lib/runtime.js`: CEP/Node 初期化と host script 呼び出し
- `client/lib/logging.js`: パネルログ出力ヘルパー
- `client/lib/bridge_utils.js`: JSON/body 解析と bridge 応答ヘルパー
- `client/lib/request_handlers_shape.js`: shape 系リクエストハンドラ（`addLayer`, `addShapeRepeater`）
- `client/lib/request_handlers_scene.js`: 宣言的 scene リクエストハンドラ（`applyScene`）
- `client/lib/request_handlers_essential.js`: Essential Graphics 系ハンドラ（`addEssentialProperty`）
- `client/lib/request_handlers_timeline.js`: タイムライン系ハンドラ（`setInOutPoint`, `moveLayerTime`, `setCTI`, `setWorkArea`）
- `client/lib/request_handlers_layer_structure.js`: レイヤー構造系ハンドラ（`parentLayer`, `precomposeLayers`, `duplicateLayer`, `moveLayerOrder`, `deleteLayer`, `deleteComp`）
- `client/lib/request_handlers.js`: コアルーターと共通エンドポイントハンドラ
- `client/lib/server.js`: HTTP サーバーの起動/エラーハンドリング

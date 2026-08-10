# CLI利用方法

## 基本確認

```bash
ae-cli --help
ae-cli health
ae-cli layers
```

`ae-cli` が `PATH` にない場合:

```bash
PYTHONPATH=src python3 -m ae_cli.main --help
```

デフォルトのブリッジURL:

- `AE_BRIDGE_URL` があればそれを使用
- なければ `http://127.0.0.1:8080`

## ローカルブリッジ認証

After Effectsパネルは起動ごとに認証トークンを生成し、`~/ae-agent-skills/.bridge-token`へ
所有者だけが読める権限で保存します。`ae-cli`はこのファイルを自動的に読み込むため、通常は設定不要です。

保存先を変更する場合は`AE_BRIDGE_TOKEN_FILE`、トークンを直接供給する必要がある場合は
`AE_BRIDGE_TOKEN`を使用できます。トークンをコマンドライン引数へ直接書かないでください。

ブリッジはlocalhostからの認証済みCLI通信だけを受け付け、Webページ由来のリクエストを拒否します。

## よく使うコマンド

```bash
ae-cli list-comps
ae-cli create-comp --name "Main" --width 1920 --height 1080 --duration 8 --frame-rate 30
ae-cli set-active-comp --comp-name "Main"
ae-cli selected-properties
ae-cli expression-errors
```

## フッテージの読み込みとカット配置

```bash
ae-cli list-footage
ae-cli import-footage --path "/absolute/path/interview.mp4" --name "Interview"
ae-cli add-footage-layer --footage-name "Interview" \
  --name "Clip 01" --source-in 12.5 --source-out 18 --timeline-in 0
ae-cli set-footage-cut --layer-name "Clip 01" \
  --source-in 13 --source-out 17.5 --timeline-in 0
```

`import-footage` は同じファイルパスのProjectItemがあれば再利用します。`add-footage-layer` では
`source-in`〜`source-out` の素材範囲を `timeline-in` から配置します。`--path` を直接指定すると、
未読み込みの場合だけimportしてからレイヤーを追加します。
既存のフッテージレイヤーは `set-footage-cut` で同じ指定方法のまま再カットできます。

## 既存コンポをレイヤーとして配置

```bash
ae-cli set-active-comp --comp-name "Main"
ae-cli add-comp-layer --comp-name "TX01_Title" \
  --name "Title 01" --start-time 2 --in-point 2 --out-point 3.8
```

`add-comp-layer` はプロジェクト内の既存コンポを、アクティブコンポへプリコンポレイヤーとして追加します。
ソースは一意な `--comp-name` または `--comp-id` で指定します。同じコンポを自身の中へ追加することはできません。

## 音量・ミュート・フェード

```bash
ae-cli get-layer-audio --layer-name "Clip 01"
ae-cli set-layer-audio --layer-name "Clip 01" \
  --unmute --level-db -6 --fade-in 0.5 --fade-out 0.75
ae-cli set-layer-audio --layer-name "Clip 01" --mute
```

`level-db` は左右チャンネルへ同じ値を設定します。`fade-in` と `fade-out` は秒数で、
レイヤーの `inPoint` / `outPoint` を基準にAudio Levelsキーフレームを作成します。
ミュートだけを変更した場合、既存のAudio Levelsキーフレームは保持されます。

## テキストスタイル

```bash
ae-cli list-fonts --query "Noto Sans" --limit 20
ae-cli get-text-style --layer-name "Title"
ae-cli set-text-style --layer-name "Title" \
  --font "ArialMT" --font-size 96 --fill-color 255 240 210 \
  --enable-stroke --stroke-color 18 34 56 --stroke-width 4 \
  --stroke-under-fill --tracking 20 --leading 110 --justification center
```

`--font` は `list-fonts` が返すPostScript名を指定します。色は0〜1または0〜255のRGBです。
`--leading` は手動行送りへ切り替わるため、`--auto-leading` とは同時指定できません。
指定した項目だけを更新し、未指定のスタイルは保持します。対象はテキストレイヤー全体です。
文字単位の混在スタイルとテキストアニメーターは対象外です。

## 整列・均等配置

```bash
ae-cli align-layers --layer-name "Title" \
  --horizontal center --vertical top --reference title-safe --offset 0 24

ae-cli distribute-layers \
  --layer-name "Card A" --layer-name "Card B" --layer-name "Card C" \
  --axis horizontal --mode gaps --reference action-safe
```

`reference` は `comp` / `action-safe` / `title-safe` / `selection` から選びます。
安全領域の既定マージンはaction-safeが10%、title-safeが20%で、`--margin-percent` で変更できます。
`gaps` はレイヤー実寸の隙間、`centers` は中心間隔を均等化します。`selection` は現在の対象全体の
外周を保持し、それ以外は基準領域の端まで使って配置します。

レイヤー実寸にはアンカーポイント、拡大縮小、回転、2D親子関係が反映されます。対象は可視の
2D AVレイヤーです。3Dレイヤー、3D親子関係、Position expressionは明示的に拒否します。
Positionにキーフレームがある場合は`--time`の位置へ値を設定します。

## 宣言的シーン適用

```bash
ae-cli apply-scene --scene-file examples/scene.example.json --validate-only
ae-cli apply-scene --scene-file examples/scene.example.json
ae-cli apply-scene --scene-file examples/scene.example.json --mode replace-managed
ae-cli apply-scene --scene-file examples/scene.example.json --mode clear-all
```

スキーマ:

- `schemas/scene.schema.json`

フッテージ編集例（`path` を実在する絶対パスへ変更して使用）:

```bash
ae-cli apply-scene --scene-file examples/footage-edit.example.json --validate-only
ae-cli apply-scene --scene-file examples/footage-edit.example.json
```

既存コンポを本編へ並べる例（`Main`、`TX01_Title`、`TX02_Subtitle` を先に作成）:

```bash
ae-cli apply-scene --scene-file examples/comp-assembly.example.json --validate-only
ae-cli apply-scene --scene-file examples/comp-assembly.example.json
```

sceneでは `assets[]` に素材を1度宣言し、複数の `type: "footage"` レイヤーから
`sourceId` で参照できます。カット範囲は `timing.sourceIn` / `sourceOut` / `timelineIn` で指定します。
音声は各フッテージレイヤーの `audio.muted` / `levelDb` / `fadeIn` / `fadeOut` で指定します。
宣言的適用では `audio` が音声状態を所有し、`muted: false`・`levelDb: 0`・フェード0秒を既定として
再適用時にAudio Levelsキーフレームを作り直します。
テキストレイヤーでは `textStyle` に `font` / `fontSize` / `fillEnabled` / `fillColor` /
`strokeEnabled` / `strokeColor` / `strokeWidth` / `strokeOverFill` / `tracking` / `leading` /
`autoLeading` / `justification` を指定できます。`textStyle` は宣言した項目だけを更新します。
トップレベルの `layout[]` には `type: "align"` または `type: "distribute"` を順番に宣言し、
`layerIds` でscene layer idを参照します。後のlayout操作は前の操作結果を基準にします。
`parentId` を宣言したレイヤーの `transform` は親座標系の値として扱い、初回適用と再適用で同じ結果になります。
既存コンポは `assets[]` に `{"id":"tx01","type":"comp","compName":"TX01_Title"}` と宣言し、
`type: "comp"` のレイヤーから `sourceId` で参照します。`timing.startTime` / `inPoint` / `outPoint` で本編上の尺を指定できます。

`apply-scene` の mode:

- `merge`（デフォルト）: upsertのみ
- `replace-managed`: 不要な `aeSceneId:*` 管理レイヤーを削除して適用
- `clear-all`: compを空にして適用

## 宣言値への収束

- `composition.width` / `height` / `duration` / `frameRate` / `pixelAspect` は、新規作成時だけでなく既存コンポにも適用されます。`--validate-only` は変更予定を `compositionChanges`、実適用は変更結果を同じフィールドで返します。
- `animations[]` はプロパティのキー集合を所有します。`keyframeMode` の既定値は `replace` で、既存キーをすべて削除してから宣言キーを作成します。空の `keyframes: []` は全キー削除です。
- 既存キーを残して宣言時刻だけ追加・更新したい場合に限り、animation単位で `"keyframeMode": "merge"` を指定します。
- 同一レイヤー内で同じ `propertyPath` を複数のanimationへ宣言するとvalidation errorになります。
- `easeIn` / `easeOut` は `[speed, influence]` です。`influence` は0.1〜100の百分率で、多次元プロパティでは各次元分の配列も指定できます。
- layoutは2D親子付きレイヤーに対応し、親transformを含むvisual boundsから親座標系のPositionを書き戻します。3D親子関係には対応しません。

## エフェクトパラメータ例

```json
{
  "effects": [
    {
      "matchName": "ADBE Drop Shadow",
      "params": [
        { "propertyIndex": 1, "value": [0, 0, 0, 1] },
        { "propertyIndex": 2, "value": 60 },
        { "propertyIndex": 3, "value": 135 },
        { "propertyIndex": 4, "value": 12 },
        { "propertyIndex": 5, "value": 8 }
      ]
    }
  ]
}
```

エフェクトのカラー値はAEネイティブのRGBA（0〜1、4要素）です。テキスト・ShapeのRGB（0〜1または0〜255、3要素）とは形式が異なります。
パラメータ順はエフェクトごとに異なるため、適用前に `properties --layer-name <layer> --include-group "ADBE Effect Parade" --include-group-children` で確認してください。

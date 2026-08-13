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

`health` は疎通だけでなく、After Effectsで現在開いているプロジェクトを返します。

```json
{
  "status": "ok",
  "project": {
    "path": "/absolute/path/project.aep",
    "name": "project.aep",
    "dirty": true,
    "saved": true
  }
}
```

未保存プロジェクトでは `path` は `null`、`saved` は `false` です。`dirty` を取得できない
AE環境では `null` になります。変更前に必ず
`project.path` が対象 `.aep` と一致することを確認してください。

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

## アクティブコンポを変えずに検査

```bash
ae-cli layers --comp-name "TX01_Title"
ae-cli layers --comp-name "TX01_Title" --brief
ae-cli expression-errors --comp-id 17
ae-cli properties --layer-name "Title" --comp-name "TX01_Title" --include-keyframes
ae-cli properties --layer-name "Title" --comp-name "TX01_Title" --filter "Opacity|Position"
ae-cli properties --layer-name "Title" --comp-name "TX01_Title" --include-expression
ae-cli properties --layer-name "Title" --comp-name "TX01_Title" --property-path "ADBE Text Properties.ADBE Text Animators"
ae-cli bounds --layer-name "Title" --comp-name "TX01_Title" --time 1.25
```

`layers`、`expression-errors`、`properties`、`bounds` は任意の `--comp-id` または一意な
`--comp-name` を受け付けます。省略時だけアクティブコンポを使い、明示したコンポをビューアで
アクティブにする副作用はありません。コンポ名が重複する場合は `--comp-id` を使用してください。

`layers` の各レイヤーには `isNull` が常に含まれるため、AE内部ではSolidとして表現される
制御用ヌルも判別できます。`properties --include-keyframes` は各プロパティに `keyframes` を追加し、
時刻、値、in/out補間と、取得可能な場合はtemporal easeを返します。
`layers --brief` はCLI表示を `id` / `layerUid` / `name` / `type` / `isNull` に限定します。
既定レスポンスやブリッジ通信量は変えず、レイヤー選択前のコンテキスト消費だけを抑えます。
`properties --filter <regex>` は取得後のCLI表示をpropertyの `name` または `path` で絞ります。
既定のブリッジ通信量は変わりません。`--include-expression` を指定した場合だけ、各propertyへ
`expression` と `expressionEnabled` を追加します。expression本文には案件固有情報が含まれ得るため、
必要な調査に限定して使用してください。
`--include-disabled` は通常の列挙から除くdisabled propertyも診断対象にします。
`--property-path <matchName path>` は階層を列挙せず1件を直接解決するため、Range Selectorの
UnitsなどAEが通常列挙しないpropertyの確認と、ブリッジ通信量の削減に使えます。

`bounds` は指定時刻のvisual boundsをコンポ座標で返します。矩形には `left` / `top` /
`right` / `bottom` / `width` / `height` / `centerX` / `centerY` が含まれます。アンカーポイント、
scale、rotation、2D親子transformを反映し、null、3D、3D親子関係、visual boundsを持たない
レイヤーは明示的なエラーになります。

## 更新先コンポを明示する

コンポ内を変更する更新系コマンドは、任意の `--comp-id` または一意な `--comp-name` を
受け付けます。指定時はそのコンポだけを処理対象として一時的にアクティブ化し、成功・失敗に
かかわらず直前のアクティブコンポへ戻します。省略時は互換性のため従来どおりアクティブコンポを
使います。案件作業では誤ったコンポへの書き込みを避けるため、明示指定を推奨します。

```bash
ae-cli set-property --comp-name "TX01_Title" --layer-name "Title" \
  --property-path "ADBE Transform Group.ADBE Opacity" --value 80
ae-cli set-cti --comp-id 17 --time 1.25
ae-cli add-layer --comp-name "TX01_Title" --layer-type null --name "Controller"
```

対象はレイヤー追加、property / keyframe / expression、effect / repeater、フッテージ・音声・
テキスト、配置、タイムライン、parent / precompose / duplicate / reorder / deleteです。
`add-comp-layer` だけは `--comp-id` / `--comp-name` がソースコンポを表すため、配置先には
`--target-comp-id` または `--target-comp-name` を使います。

## コンポのスナップショット

```bash
ae-cli snapshot --comp-name "TX01_Title" \
  --time 1.25 --out "/absolute/path/tx01-1.25.png" --scale 0.5
```

指定compの1フレームをPNGへ保存します。`--comp-id` または一意な `--comp-name` は必須、
`--time` の既定は0秒、`--scale` は0より大きく1以下（既定1）です。出力先の親ディレクトリは
事前に存在する必要があり、既存ファイルは上書きしません。

After Effectsは最終パスへ直接書かず、同じディレクトリのランダムな一時PNGへ出力します。
PNG終端まで書き込まれたことを待ってから最終名へ移動し、失敗時は一時ファイルを削除します。viewer tabやactive compは
変更しません。縮小時は一時compを内部で作成し、出力後に削除します。

## フッテージの読み込みとカット配置

```bash
ae-cli list-footage
ae-cli import-footage --path "/absolute/path/interview.mp4" --name "Interview"
ae-cli add-footage-layer --comp-name "Main" --footage-name "Interview" \
  --name "Clip 01" --source-in 12.5 --source-out 18 --timeline-in 0
ae-cli set-footage-cut --comp-name "Main" --layer-name "Clip 01" \
  --source-in 13 --source-out 17.5 --timeline-in 0
```

`import-footage` は同じファイルパスのProjectItemがあれば再利用します。`add-footage-layer` では
`source-in`〜`source-out` の素材範囲を `timeline-in` から配置します。`--path` を直接指定すると、
未読み込みの場合だけimportしてからレイヤーを追加します。
既存のフッテージレイヤーは `set-footage-cut` で同じ指定方法のまま再カットできます。

## 既存コンポをレイヤーとして配置

```bash
ae-cli add-comp-layer --comp-name "TX01_Title" \
  --target-comp-name "Main" \
  --name "Title 01" --start-time 2 --in-point 2 --out-point 3.8
```

`add-comp-layer` はプロジェクト内の既存コンポを、明示した対象コンポ（省略時はアクティブコンポ）へ
プリコンポレイヤーとして追加します。ソースは一意な `--comp-name` または `--comp-id`、配置先は
`--target-comp-name` または `--target-comp-id` で指定します。同じコンポを自身の中へ追加することはできません。

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
ae-cli get-text-style --layer-name "Title" --comp-name "TX01_Title"
ae-cli set-text-style --layer-name "Title" \
  --font "ArialMT" --font-size 96 --fill-color 255 240 210 \
  --enable-stroke --stroke-color 18 34 56 --stroke-width 4 \
  --stroke-under-fill --tracking 20 --leading 110 --justification center
```

`--font` は `list-fonts` が返すPostScript名を指定します。色は0〜1または0〜255のRGBです。
`--leading` は手動行送りへ切り替わるため、`--auto-leading` とは同時指定できません。
指定した項目だけを更新し、未指定のスタイルは保持します。対象はテキストレイヤー全体です。
`get-text-style` は `layers` / `properties` / `bounds` と同様に、任意の `--comp-id` または
一意な `--comp-name` を受け付けます。

文字範囲スタイルとRange SelectorテキストアニメーターはJSON配列で指定します。

```bash
ae-cli set-text-style-ranges --layer-name "Title" --ranges-file ranges.json
ae-cli set-text-animators --layer-name "Title" --animators-file animators.json
```

範囲は0始まり・終端を含まない `{ "start": 0, "end": 3, "style": {...} }` です。
`font` / `fontSize` / fill / stroke / `tracking` を文字範囲ごとに設定できます。この機能は
`TextDocument.characterRange()`を使うためAfter Effects 24.3以降が必要です。
テキストアニメーターはPosition / Scale / Opacity / Rotationと、Range Selectorの
Start / End / Offset / Amountおよびそのキーフレームに対応します。selectorにはさらに
`units`（1: Percentage、2: Index）、`basedOn`（1: Characters、2: Characters Excluding Spaces、
3: Words、4: Lines）、`shape`（1: Square、2: Ramp Up、3: Ramp Down、4: Triangle、5: Round、
6: Smooth）、`smoothness`（0〜100）、`easeHigh` / `easeLow`（-100〜100）を指定できます。

## 整列・均等配置

```bash
ae-cli align-layers --layer-name "Title" \
  --horizontal center --vertical top --reference title-safe --offset 0 24

ae-cli distribute-layers \
  --layer-name "Card A" --layer-name "Card B" --layer-name "Card C" \
  --axis horizontal --mode gaps --reference action-safe

ae-cli visual-center --layer-name "Title" --time 0.8
```

`reference` は `comp` / `action-safe` / `title-safe` / `selection` から選びます。
安全領域の既定マージンはaction-safeが10%、title-safeが20%で、`--margin-percent` で変更できます。
`gaps` はレイヤー実寸の隙間、`centers` は中心間隔を均等化します。`selection` は現在の対象全体の
外周を保持し、それ以外は基準領域の端まで使って配置します。

レイヤー実寸にはアンカーポイント、拡大縮小、回転、2D親子関係が反映されます。対象は可視の
2D AVレイヤーです。3Dレイヤー、3D親子関係、Position expressionは明示的に拒否します。
Positionにキーフレームがある場合は`--time`の位置へ値を設定します。
`visual-center` は指定時刻のvisual bounds中央へアンカーポイントを移し、コンポ上の見た目の位置を保持します。

## 宣言的シーン適用

```bash
ae-cli apply-scene --scene-file /path/to/project/_edl/main.scene.json \
  --expect-project /path/to/project/main.aep --validate-only
ae-cli apply-scene --scene-file /path/to/project/_edl/main.scene.json \
  --expect-project /path/to/project/main.aep
ae-cli apply-scene --scene-file /path/to/project/_edl/main.scene.json \
  --expect-project /path/to/project/main.aep --mode replace-managed
ae-cli apply-scene --scene-file /path/to/project/_edl/main.scene.json \
  --expect-project /path/to/project/main.aep --mode clear-all
```

`--expect-project` はCLI側で絶対パスへ解決され、After Effectsで開いているプロジェクトの
絶対パスと一致しない場合、`--validate-only` と実適用のどちらも変更前に異常終了します。
誤った `.aep` への適用を防ぐため、案件作業では省略しないでください。

実適用中にエラーが起きた場合、`apply-scene` はcomp作成、ProjectItem import、layer変更を含む
専用Undo groupを直ちに1回Undoします。transaction markerが消えた場合だけ
`rollback.succeeded: true` としてCLIエラーへ報告します。markerを確認できない場合は、無関係な
Undo履歴を戻さないため自動Undoを実行しません。AE 26.3では内容の復元を確認していますが、
保存済みclean projectでも成功したrollback後に `project.dirty: true` が残ります。CLIは自動保存
しないため、`rollback` 診断と対象comp / ProjectItemを確認してから保存または再読み込みしてください。

案件固有のscene JSON、EDL、生成スクリプトは対象 `.aep` と同じ案件ディレクトリに置きます。
サブディレクトリ名には `_edl/` を推奨しますが、既存の案件構成に合わせて変更できます。
`~/ae-agent-skills/` は横断再利用するエンジン、schema、referenceに限定し、
`work/` と `done/` へコピーする二重管理は行いません。

スキーマ:

- `schemas/scene.schema.json`

フッテージ編集例（`path` を実在する絶対パスへ変更して使用）:

```bash
ae-cli apply-scene --scene-file examples/footage-edit.example.json --expect-project /path/to/project/main.aep --validate-only
ae-cli apply-scene --scene-file examples/footage-edit.example.json --expect-project /path/to/project/main.aep
```

既存コンポを本編へ並べる例（`Main`、`TX01_Title`、`TX02_Subtitle` を先に作成）:

```bash
ae-cli apply-scene --scene-file examples/comp-assembly.example.json --expect-project /path/to/project/main.aep --validate-only
ae-cli apply-scene --scene-file examples/comp-assembly.example.json --expect-project /path/to/project/main.aep
```

テロップ量産用の上位DSL例:

```bash
python examples/gen_telop.py --out-dir /path/to/project/_edl/telops
target_aep=/path/to/project/main.aep
for scene in /path/to/project/_edl/telops/*.scene.json; do
  ae-cli apply-scene --scene-file "$scene" --expect-project "$target_aep" --validate-only
done
```

既定はmacOS標準の日本語対応PostScript名 `HiraginoSans-W6` です。別環境では
`list-fonts` で確認した日本語対応フォントを `--font` に指定してください。

`layers[].textStyleRanges` は再適用時の基準を復元するため同じレイヤーの `textStyle` を必須とします。
`layers[].textAnimators` は `aeSceneTextAnimator:*` 管理アニメーターを置換します。
`layout[]` の `type: "visual-center"` は `align` より前に置くと、アンカーを整えてから配置できます。

sceneでは `assets[]` に素材を1度宣言し、複数の `type: "footage"` レイヤーから
`sourceId` で参照できます。カット範囲は `timing.sourceIn` / `sourceOut` / `timelineIn` で指定します。
`assets[].path` は絶対パスに加え、scene JSONのディレクトリを基準にした相対パスと
`${MEDIA_ROOT}/clip.mov` 形式の環境変数を使用できます。CLIは適用前に絶対パスへ解決し、
参照した環境変数が未定義なら異常終了します。
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

実適用のレスポンスでは、影響した各レイヤーを `layers` / `appliedLayers` に返します。
各要素の `id` / `layerId` / `layerName` と `action: "created" | "updated"` で結果を確認できます。
`newlyCreatedLayers` と `updatedLayers` はaction別の一覧です。既存互換性のため、従来の
`createdLayers` は引き続き全適用レイヤーを表す `appliedLayers` の別名です。

## 宣言値への収束

- `composition.width` / `height` / `duration` / `frameRate` / `pixelAspect` は、新規作成時だけでなく既存コンポにも適用されます。`--validate-only` は変更予定を `compositionChanges`、実適用は変更結果を同じフィールドで返します。
- `animations[]` はプロパティのキー集合を所有します。`keyframeMode` の既定値は `replace` で、既存キーをすべて削除してから宣言キーを作成します。空の `keyframes: []` は全キー削除です。同じパスの静的値を `transform` または `propertyValues` に宣言した場合は、削除後にその値へ戻します。静的値を宣言しない場合は、キー削除後にAEが保持する値をそのまま使います。
- 既存キーを残して宣言時刻だけ追加・更新したい場合に限り、animation単位で `"keyframeMode": "merge"` を指定します。
- 同一レイヤー内で同じ `propertyPath` を複数のanimationへ宣言するとvalidation errorになります。
- `easeIn` / `easeOut` は `[speed, influence]` です。`influence` は0.1〜100の百分率で、多次元プロパティでは各次元分の配列も指定できます。
- layoutは2D親子付きレイヤーに対応し、親transformを含むvisual boundsから親座標系のPositionを書き戻します。3D親子関係には対応しません。
- `textStyleRanges` は `textStyle` で全体を基準化してから半開区間の文字スタイルを再適用します。
- `textAnimators` は管理対象を再構築するため、selector animationのキー集合も毎回宣言値へ置換されます。

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

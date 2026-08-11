# 実作業フィードバック追跡（2026-08-10）

縦型ショート動画のテロップ7本を `apply-scene` で制作した際のフィードバックを、実装と実機確認まで追跡する。
状態が「実装済み」でも、After Effects実機確認が終わるまでは完了扱いにしない。

## 対応状況

| # | 課題 | 状態 | 対象 |
| --- | --- | --- | --- |
| 1 | 既存compをレイヤーとして追加できない | 完了（実機確認済み） | v0.8（v0.9.0収録） |
| 2 | 既存compのcomposition設定が更新されない | 完了（実機確認済み） | v0.9.0 |
| 3 | mergeで宣言外キーフレームが残る | 完了（実機確認済み） | v0.9.0 |
| 4 | snapshotを取得できない | 完了（実機確認済み） | v0.11.0 |
| 5 | レイヤーのvisual boundsを取得できない | 完了（実機確認済み） | v0.10.0 |
| 6 | layers / expression-errorsがactive comp固定 | 完了（実機確認済み） | v0.10.0 |
| 7 | propertiesでキーフレームを取得できない | 完了（実機確認済み） | v0.10.0 |
| 8 | 2D親子付きlayoutの可否と視覚中心揃えが不明 | 実装済み・実機確認待ち | v0.7〜v0.12 |
| 9 | easeIn / easeOutの形式が不明 | 実装済み | v0.9.0 |
| 10 | text animator未対応 | 実装済み・実機確認待ち | v0.12.0 |
| 11 | 文字範囲スタイル未対応 | 実装済み・実機確認待ち | v0.12.0 |
| 12 | effectのカラーパラメータ指定が不明 | ドキュメント対応済み | v0.9.0 |
| 13 | layersでnullとsolidを区別できない | 完了（実機確認済み） | v0.10.0 |

補足提案の「上位DSLからscene JSONを生成する量産例」は `examples/gen_telop.py` として追加済み。

## v0.10.0 読み取り・検証

アクティブcompを変更せず、複数compを安全に検査できる状態を完了条件とする。

### インターフェース

- `ae-cli layers [--comp-id ID | --comp-name NAME]`
- `ae-cli expression-errors [--comp-id ID | --comp-name NAME]`
- `ae-cli properties (--layer-id ID | --layer-name NAME) [--comp-id ID | --comp-name NAME] [--include-keyframes]`
- `ae-cli bounds (--layer-id ID | --layer-name NAME) [--comp-id ID | --comp-name NAME] [--time SEC]`
- `GET /layers` と `GET /expression-errors` は `compId` / `compName` を任意指定でき、省略時だけactive compを使う
- `GET /properties` は `includeKeyframes=true` で各propertyに `keyframes[]` を追加する
- `GET /layer-bounds` はcomp座標の `left` / `top` / `width` / `height` / `right` / `bottom` / `centerX` / `centerY` を返す
- `layers` の各要素に `isNull` を常に含める

### キーフレーム出力

`keyframes[]` は最低限 `index` / `time` / `value` / `inInterpolation` / `outInterpolation` を返す。
取得できる場合は `inTemporalEase` / `outTemporalEase` も返す。値はscene JSONへ再利用できるJSON互換値を優先し、変換できないAE固有値は既存の文字列表現へフォールバックする。

### 受け入れ条件

- active compがAの状態で、comp指定したBのlayers / expression errors / properties / boundsを取得してもactive compがAのまま
- comp名が重複する場合は `compId` の利用を促すエラーになる
- text / shape / footage / precompのboundsが親transformを含むcomp座標で取得できる
- nullやvisual bounds非対応レイヤーは、誤った矩形ではなく明示的なエラーになる
- keyframe 0件・1件・複数件、linear / bezier / holdを区別できる
- nullは `type: "Solid"` のままでも `isNull: true` で判別できる

## v0.11.0 ビジュアル検証

- `ae-cli snapshot --comp-name X --time T --out FILE [--scale S]`
- active compやviewer tabを変更せずPNGを出力する
- 出力失敗時に部分ファイルを残さない
- 既存出力は上書きせず、一時PNGを成功後だけ最終名へ移動する
- 1080×1920、任意時刻、0.5 scaleを実機で確認する

実装は `CompItem.saveFrameToPng(time, File)` を利用する。現行のAdobe After Effects Scripting
Guideにはこのメソッドが掲載されていないため、実行時に存在を確認し、未対応環境では明示エラーにする。
実機で利用不可だった場合はRender Queue経由のフォールバックをv0.11の範囲で再設計する。

初回実機テストで `saveFrameToPng` が呼び出し復帰後にPNGを書き終える非同期挙動を確認した。
ホスト側の即時存在確認を廃止し、CEP側でPNGのIEND終端まで待ってから最終化するよう修正済み。
縮小用一時compも書き出し完了後に明示削除する。

## After Effects実機確認（2026-08-10）

- 専用テストcomp `__AE_AGENT_V011_SOURCE__` / `MAIN` / `ALT` / `API_TARGET` のみを新規作成して検証した
- `type: "comp"` は11回の再適用でも重複せず、同じlayer UIDを維持した。別compへのsource差し替えと復元、`compId`による直接追加、timing指定、自己ネスト拒否も確認した
- 既存compのwidth / height / pixelAspect / frameRate / durationはvalidate-onlyで5差分を列挙し、適用後の実値へ反映された。元設定への復元も確認した
- keyframeの既定replace、明示merge、空配列による全削除を確認した。`properties --include-keyframes` で時刻・値・補間・temporal easeを取得できた
- active compをMainに保ったままSourceのlayers / expression-errors / properties / boundsを取得できた。text / shape / footage / precompはcomp座標bounds、nullは明示エラー、nullの`isNull: true`を確認した
- 2D親子付きtextをlayoutでcomp中央へ配置でき、取得boundsの中心は正確にcomp中央だった
- 非active compへ`composition.setActive: false`で`apply-scene`した際、legacy mutation helperがactive compを参照する不具合を実機で発見した。適用中だけ対象compをactiveにし、完了・失敗後に直前のactive compを復元するよう修正し、実機再確認済み
- snapshot初回試験では、AEが`saveFrameToPng`から復帰した後にPNGを完成させることを確認した。CEP再読込後、1080×1920と0.5倍の540×960を実出力し、PNGの目視、任意時刻、`compId` / `compName`、active comp維持を確認した
- snapshot成功後は`.part.png`と縮小用一時compが残らない。既存出力は拒否されSHA-256が不変、無効時刻の失敗時にも最終ファイル・部分ファイル・一時compが残らないことを確認した
- scale時の一時comp作成・削除によるproject dirty / Undo履歴への影響は、現行APIから状態を直接取得できず、既に変更済みのテストprojectでは分離確認できない。機能上の既知の確認限界として残す

## v0.12.0 テキスト表現

- Range Selectorを使うtext animatorのPosition / Scale / Opacity / Rotationを `textAnimators[]` で宣言する
- 文字範囲ごとのfont / font size / fill / stroke / trackingを `textStyleRanges[]` で宣言する（AE 24.3以降）
- 上位DSLから複数sceneを生成する `examples/gen_telop.py` を追加する
- `visual-center` でアンカーをvisual bounds中央へ移し、画面上の位置を保持する
- 自動テストとAfter Effects実機確認を完了した。確認内容は下記に記録する

## v0.12.0 After Effects実機確認（2026-08-10）

- 専用comp `__AE_AGENT_V012_TEXT_TEST__` で、Range Selector animatorのPosition / Scale / Opacity / RotationとStartの2キーフレームを適用し、値・bezier補間・temporal easeを読み戻した
- AEのText Animator Propertiesには未追加項目がhidden placeholderとして見えるため、既存判定すると`setValue`が失敗することを発見した。必ず`addProperty`で有効化し、失効した参照をproperty indexから取り直すよう修正して実機再確認した
- `TEXT RANGE 2026` の半開区間 `[11, 15)` にfont / fontSize / fill / stroke / trackingを混在適用し、PNGで「2026」だけに反映されることを確認した。空の`textStyleRanges` / `textAnimators`で基準スタイルへの復帰とanimator削除も確認した
- `visual-center` 前後のvisual boundsは誤差0.0001px未満で保持され、アンカーポイントとPositionだけが補正された
- 同じsceneの再適用で対象レイヤーはUIDを維持し、管理対象animatorは1個のままで重複しなかった。expression errorは0件だった
- `examples/gen_telop.py` を日本語対応PostScriptフォント`HiraginoSans-W6`で実行し、生成した3sceneをvalidate / apply / 再applyした。各compは1レイヤー・1animatorを維持した
- Pythonテスト94件、Nodeテスト53件、両skill validator、`npm pack --dry-run`が成功した

## v0.10.0 実装セッション引き継ぎ（2026-08-10）

- 実装ブランチ: `agent/inspection-v0.10`
- Pythonテスト: 89件成功
- Nodeテスト: 37件成功
- `aftereffects-cli` / `aftereffects-declarative`: `quick_validate.py` 成功
- `npm pack --dry-run`: `ae-agent-skills@0.10.0` として成功
- scene schemaの追加・変更は不要（v0.10は読み取りAPIのみ）
- AE実機確認は未実施。`ae-cli health` が `~/ae-agent-skills/.bridge-token` 不在で停止したため、更新済みパネルを起動してから本書のv0.8〜v0.10受け入れ条件を実行する
- 実機確認後に本表の「実機確認待ち」を完了へ更新し、コミット・PR・リリース判断へ進む

## v0.11.0 実装セッション引き継ぎ（2026-08-10）

- Pythonテスト: 90件成功
- Nodeテスト: 46件成功
- `aftereffects-cli` / `aftereffects-declarative`: `quick_validate.py` 成功
- `npm pack --dry-run`: `ae-agent-skills@0.11.0` として成功し、snapshot用CEP / hostファイルを収録
- scene schemaの追加・変更は不要（snapshotは命令型の検証コマンド）
- 実機ではfull scale、0.5 scale、任意時刻、active comp / viewer維持、一時comp / `.part.png` cleanup、既存出力保護を確認する
- `scale < 1` は一時ラッパーcompを作成・削除するため、Project dirty状態とundo履歴への影響も確認する

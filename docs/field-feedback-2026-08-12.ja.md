# 実作業フィードバック追跡（2026-08-12）

既存 `.aep` テンプレートと `apply-scene` を使った2件の実制作フィードバックを、観測事実、
利用者が提示した解決案、採否判断に分けて追跡する。単一案件の提案をそのまま仕様へせず、
既存互換性、失敗時の安全性、再実行性、保守コストを含めて判断する。状態が「実装済み」でも、
After Effects実機確認が必要な項目は完了扱いにしない。

## 判断原則

- フィードバックで観測された問題は一次資料として重視するが、提示syntaxや削減見積もりは未検証の案として扱う
- 人がレビューするauthoring sourceと、AEへ適用するcanonical sceneを区別する
- 既定レスポンスの削減や共通envelope化で既存利用者を壊さず、まずオプトインの小さい出力を追加する
- sceneが所有すると宣言した範囲は再適用で同じ状態へ収束させ、非対応項目を命令型後処理で隠さない
- 静止画、property値、keyframe列で自動確認できる事実と、人の再生確認が必要なモーション品質を分ける

## 判断と対応状況

| 優先度 | 課題 | 判断 | 状態 |
| --- | --- | --- | --- |
| P0 | 開いているプロジェクトを識別できない | 誤った完成データを上書きし得るため最優先 | 実装済み・AE 26.3確認済み |
| P0 | `apply-scene` にプロジェクト不一致ガードがない | `health` の目視だけでなく変更直前の強制停止が必要 | 実装済み・AE 26.3確認済み |
| P0 | apply途中の実行時エラーで部分変更が残る | comp作成を含む全mutationを専用Undo groupへ移し、transaction markerで自動Undoの対象を検証する | 内容rollback実装・AE 26.3確認済み。dirty復元は未対応 |
| P0 | scene JSONがグローバルな `work/` / `done/` に分散 | 案件成果物は `.aep` と同じ案件側へ置き、二重管理を廃止。`_edl/` は強制名ではなく推奨default | skill・日英CLI文書を更新済み |
| P1 | `open-project` / `save` / `save-as` がない | 入口・出口の自動化には有効。ただし保存は不可逆性が高く、P0ガードの実機確認後に設計する | 次段階 |
| P1 | 全コマンドでプロジェクト情報が見えない | 共通レスポンス形式を変えると既存の配列レスポンスと互換性が衝突する。まず `health` と `apply-scene` を安全経路にする | 部分対応・継続設計 |
| P1 | `assets[].path` が端末固有の絶対パス | scene相対パスと `${MEDIA_ROOT}` 形式をCLIで絶対パスへ解決し、未定義変数は適用前に拒否する | 実装済み・AE 26.3確認済み |
| P1 | text Range Selectorの一部をsceneで宣言できない | scene単体の再適用で収束しない具体的な欠落。matchNameと値域をAE 26.3で確認して追加する | 実装済み・AE 26.3往復確認済み |
| P1 | mutationの書き込み先compがactive comp依存 | 利便性ではなく誤操作防止。既存active方式を残しつつ明示selectorを一貫導入する | 実装済み・AE 26.3確認済み |
| P2 | `get-text-style` だけcomp指定不可 | 他の読み取りコマンドと統一する | 実装済み・AE 26.3確認済み |
| P2 | comp / layer / ProjectItemのrename・ProjectItem削除 | 迂回を減らせるが、参照破壊と同名衝突の安全仕様が必要 | 次段階 |
| P2 | 曖昧レイヤーエラーが `layerId` 表記 | CLIでそのまま使える `--layer-id` を併記する | 実装済み |
| P2 | `apply-scene` の影響レイヤーが不明 | actionつき一覧を返す。旧 `createdLayers` は互換維持 | 実装済み・AE 26.3確認済み |
| P2 | `layers` / `properties` の表示が大きい | 既定を変えず、`layers --brief` / `properties --filter` / `--property-path` を追加 | 実装済み・AE 26.3確認済み |
| P2 | expression本文をqueryできない | `properties --include-expression` の明示時だけ本文とenabled状態を返す | 実装済み・AE 26.3確認済み |
| P3 | scene authoringが定型展開で巨大化する | `stack` 等を即採用せず、canonical schema拡張、preprocessor、生成器ライブラリをfixtureで比較する | 設計スパイク待ち |

## 今回実装した仕様

### `health`

`ae-cli health` は次のプロジェクト情報を返す。

- `project.path`: 保存済み `.aep` の絶対パス。未保存なら `null`
- `project.name`: プロジェクト名
- `project.dirty`: 未保存変更の有無。AEホストが状態を公開しない場合は `null`
- `project.saved`: 保存済みファイルを持つか

### `apply-scene --expect-project`

- CLIで受け取ったパスを絶対パスへ解決してブリッジへ渡す
- After Effects側で現在の `app.project.file.fsName` と比較する
- 不一致または未保存プロジェクトなら、scene validationやUndo group開始より前に異常終了する
- `--validate-only` にも同じガードを適用し、実適用前の確認段階で誤りを発見する
- 成功・validation error・適用エラーのレスポンスへ現在の `project` を含める

### apply失敗時のtransaction rollback

- transaction先頭に一意なProject Folder markerを作り、comp作成、ProjectItem import、layer変更を同じUndo groupへ含める
- 成功時はgroup内でmarkerを削除し、Projectに残さない
- runtime error時はgroupを閉じた直後、active comp復元など別操作を挟まずUndo command ID 16を1回実行する
- Undo後にmarkerが消えた場合だけ `rollback.succeeded: true` とする。markerがなければ無関係な履歴を戻す恐れがあるためUndoしない
- `rollback` はattempted / succeeded / marker / dirty / warning / errorを返し、CEPとPython clientがCLIエラーへ保持する
- AE 26.3ではcomp、既存layerのname/text/UID、importしたProjectItemを復元できた。ただし保存済みclean状態からのrollbackでもdirtyはtrueになり、自動保存では安全に復元できないため残す

### ファイル運用

- `~/ae-agent-skills/`: 横断再利用する生成エンジン、schema、reference
- `<案件>/_edl/`: 案件固有のscene JSON、EDL、薄い生成スクリプトを置く推奨default。既存の案件構成へ強制しない
- `work/` から `done/` へのコピーは行わず、案件側のGit・同期ストレージ・バックアップへ一本化

### 小さい観測出力とapply結果

- `layers --brief`: `id` / `layerUid` / `name` / `type` / `isNull` だけをCLIへ表示する
- `properties --filter <regex>`: 取得済みpropertyを `name` / `path` で絞る。ブリッジ通信量は変えない
- `properties --include-expression`: 明示時だけexpression本文とenabled状態を取得する
- `properties --include-disabled`: 通常は除外するdisabled propertyも診断用に列挙する
- `properties --property-path <matchName path>`: property tree全体を列挙せず1件を直接取得する。通常列挙されないRange Selector詳細値にも到達できる
- `layers` / `appliedLayers`: actionを含む全適用レイヤー
- `newlyCreatedLayers` / `updatedLayers`: action別の一覧
- `createdLayers`: 既存互換性のため、従来どおり全適用レイヤーを表す `appliedLayers` のalias

### Range Selectorとキー全削除

- `textAnimators[].selector` に `units` / `basedOn` / `shape` / `smoothness` / `easeHigh` / `easeLow` を追加した
- AEのShape変更でSmoothnessが一時的に無効化される組み合わせがあるため、SmoothnessとEaseを先に、Units / Based On / Shapeを最後に適用する
- `animations[].keyframes: []` は既存キーを全削除する
- 同じproperty pathの静的値が `transform` または `propertyValues` にある場合は、キー削除後にその値を再適用する
- 静的値を宣言しない場合は、AEが最後のキー削除後に保持する値を採用する。sceneが静止値まで所有するなら必ず明示する

### mutationの明示comp selector

- comp内容を変更する既存コマンドへ、任意の `--comp-id` / 一意な `--comp-name` を共通追加した
- selector指定時だけ対象compを一時的にアクティブ化し、処理成功・host例外のどちらでも直前のactive compを復元する
- selector省略時は既存互換のためactive compを対象にする
- `add-comp-layer` は既存の `--comp-id` / `--comp-name` がソース指定のため、配置先を `--target-comp-id` / `--target-comp-name` とした
- create / import / delete-compはcomp内容を対象とせず、`set-active-comp` はactive変更自体が目的なので共通selectorの対象外とした

## 実機受け入れ条件

- 保存済み `.aep` で `health.project.path/name/dirty/saved` が実値と一致する
- 未保存プロジェクトで `path: null` / `saved: false` になる
- 正しい `--expect-project` ではvalidate/applyできる
- 別 `.aep` と未保存プロジェクトでは、対象comp・レイヤー・ProjectItem・dirty状態を変えずに失敗する
- Unicode、空白、OneDrive配下、外付けボリューム配下のパスで比較できる
- `get-text-style --comp-name` / `--comp-id` がactive compを変えずに取得できる
- apply結果のid・name・actionと `newlyCreatedLayers` / `updatedLayers` がAE上の結果に一致する
- `createdLayers` が旧来の全適用レイヤーaliasを維持する
- `properties --include-expression` が改行、引用符、Unicode、disabled expressionを往復できる
- Range Selector詳細6項目がscene宣言値とAEの実値で一致し、再適用してもanimatorが重複しない
- `properties --property-path` が通常列挙されないpropertyを1件だけ返す
- `keyframes: []` と静的値の併記で、キー0件かつ宣言した静的値へ収束する
- runtime error時の内容rollbackがmarkerで検証され、失敗・未検証時は部分変更の可能性を明示する
- rollback前がcleanでもdirtyだけはtrueになり得ることを文書とrelease判断で隠さない
- 明示compを指定したmutationがactiveではない対象だけを変更し、成功・失敗後に元のactive compへ戻る
- selectorを省略したmutationが従来どおりactive compを対象にする
- `add-comp-layer --target-comp-name` がsource selectorと衝突せず、明示した配置先へ追加する

## 次段階の判断ゲート

1. rollbackをAEの別version / localeでも実機確認し、固定Undo IDが使えない場合は成功扱いしない
2. Unicode・空白、OneDrive、外付けボリュームのproject path比較を環境ごとに確認する
3. 共通レスポンスのproject identity、`open-project`、`save` / `save-as` は後方互換性と上書き安全モデルを比較してから決める
4. authoring圧縮は匿名化fixtureを使い、canonical schema拡張、CLI preprocessor、生成器ライブラリを別々に評価する

`stack`、motion preset、style token、`widthFrom`、shadow shorthandを一括実装しない。行数だけでなく、
エラー位置、決定性、AE内実寸の必要性、循環、versioning、再適用時の所有権を比較する。

## After Effects実機確認（2026-08-13）

- After Effects 2026（26.3）と開発用CEPパネルを使用し、既存案件ではなく `/private/tmp/ae-agent-v013/identity-test.aep` だけを変更した
- 未保存projectでは `health` が `path: null` / `saved: false`、保存後は絶対path / name / dirty / savedを実状態どおり返した
- 誤った `--expect-project` はvalidation前に拒否し、前後でdirty、comp一覧、footage一覧が変化しなかった。`/tmp` と `/private/tmp` の正規化も一致した
- 正しい `--expect-project` ではvalidate/applyに成功した
- sceneのlayer配列はbottom-to-topで、先頭要素がAEの大きいlayer index、末尾要素がindex 1になった
- 初回applyは3レイヤーを `newlyCreatedLayers`、再applyは同じlayer UIDの3レイヤーを `updatedLayers` に返した。旧 `createdLayers` は全適用レイヤーaliasを維持した
- `layers --brief` は5項目だけを返した。`get-text-style --comp-name` はactive compを変えずに別compを取得した
- `properties --include-expression --filter Opacity` は日本語コメントを含むexpression本文を往復した
- scene JSON基準の `../media/relative-clip.mp4` は絶対pathへ解決され、validate/apply/importと `list-footage` のpathが一致した
- primitive rectangle shapeのboundsは320×120を返し、0×0問題はこの最小例では再現しなかった
- Range Selector詳細は `units=1` / `basedOn=1` / `shape=2` / `smoothness=100` / `easeHigh=70` / `easeLow=20` を適用し、`properties --property-path` で全値を往復確認した
- `keyframes: []` の実機再現では、修正前はOpacityの2キー削除後に古い先頭キー値10が残った。修正後はキー0件かつ併記した静的値80へ収束した
- advanced selectorの不正値と、修正前の適用順エラーはいずれもエラー終了後に作成済みcomp/layerを残した。Undo groupは履歴をまとめるが自動rollbackではないことを確認した
- 修正後は意図的なruntime errorを3系統で発生させ、新規comp/layer、既存text layerのname/text/UID、import直後のProjectItemがすべて元状態へ戻ることを確認した
- transaction markerは成功apply後・失敗rollback後とも0件だった。通常applyの再適用も成功した
- 固定Undo ID 16はAE 26.3日本語環境でgroup全体を戻した。`findMenuCommandId("取り消し")` が返した2371はUndoとして機能しなかったため採用しない
- clean projectからrollbackすると内容は戻るがdirtyはtrueになった。失敗時の自動保存は行わない
- 非activeの `V013_Main` を明示してnull追加・削除を行い、指定compだけが変わってactiveの `V013_Keyframe_Clear` が維持された
- `add-comp-layer --target-comp-name V013_Main` で `V013_Baseline` を一時配置でき、削除後は元の3レイヤーへ戻った。source selectorとtarget selectorは衝突しなかった
- 明示comp内の存在しないlayerへ更新して失敗した場合も、active compは `V013_Keyframe_Clear` へ復元された
- パネル再読込後のCLIで、意図的なapply失敗に `Rollback: succeeded` とdirty未復元warningが表示された。既存text layerのname / UID /本文とactive compは復元された

未確認または人手確認が必要な項目:

- Unicode・空白、OneDrive、外付けボリュームのproject path比較
- expressionのdisabled状態、引用符、複数行を組み合わせた追加fixture
- primitive以外のshape bounds 0再現条件
- モーションのリズム・見た目。値とキー列の一致だけでは品質を断定しない

## 自動検証（2026-08-13）

- Python: `.venv/bin/python -m pytest -q`、105件成功
- Node: `npm run test:node`、78件成功
- `git diff --check` 成功
- AEを使わない検証では、project guard、query/mutation comp selector、brief/filter/expression/disabled/exact-path query、advanced selector、空キー集合の静的値復元、transaction markerとrollback診断、apply結果fieldの互換性を確認した

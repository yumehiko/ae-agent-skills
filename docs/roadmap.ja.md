# ロードマップ

機能を小さく保ち、原則として1機能を1マイナーバージョンで追加する。
実作業フィードバックとの対応と受け入れ条件は `field-feedback-2026-08-10.ja.md` で追跡する。

| バージョン | テーマ | 状態 | 対象範囲 |
| --- | --- | --- | --- |
| v0.4.0 | フッテージ編集 | リリース済み | 素材のimport・再利用、区間カット、タイムライン配置 |
| v0.5.0 | 音声編集 | リリース済み | 音量、ミュート、フェードイン／アウト、映像素材の音声制御 |
| v0.6.0 | テキストスタイル | リリース済み | フォント、サイズ、色、字間、行間、揃え、線 |
| v0.7.0 | コンポジション配置 | リリース済み | 整列、分布、基準位置、安全領域を使った配置 |
| v0.8.0 | プリコンポ配置 | v0.9.0収録・実機確認済み | 既存コンポをレイヤーとして追加、scene asset参照、upsert・source差し替え |
| v0.9.0 | 宣言値への収束 | リリース済み・実機確認済み | 既存comp設定更新・実値照合、animationのkeyframe replace既定・明示merge |
| v0.10.0 | 読み取り・検証 | 実装・実機確認済み | comp指定layers/expression-errors、bounds、keyframe情報、isNull |
| v0.11.0 | ビジュアル検証 | 実装・実機確認済み（dirty / Undoは未観測） | comp snapshotのPNG出力、時刻・scale指定、失敗時cleanup |
| v0.12.0 | テキスト表現 | 検討 | テキストアニメーター、文字範囲スタイル |

各バージョンでは、scene JSON、個別CLI、スキーマ、agent skill、使用例、自動テスト、After Effects実機テストまでを完了条件とする。

高度な音声エフェクト、文字単位の混在スタイル、完全なレスポンシブレイアウトは初期MVPに含めず、基本編集を完走できる機能を優先する。

## v0.8.0 実機確認項目

- `add-comp-layer` が `compId` / 一意な `compName` の両方で配置できる
- `startTime` / `inPoint` / `outPoint` が本編上の期待時刻になる
- sceneの `type: comp` レイヤーを10回以上再適用しても重複しない
- 同じscene layer idで `sourceId` を変更すると既存レイヤーのsourceが差し替わる
- ソースcompと対象compが同じ場合、およびcomp名が重複する場合に安全にエラーになる

## v0.9.0 実機確認項目

- 既存compへ `width` / `height` / `pixelAspect` / `frameRate` / `duration` が反映される
- `--validate-only` の `compositionChanges` と実適用結果が一致する
- 3キーから2キーへ再適用すると、宣言から消えた3つ目のキーが削除される
- `keyframes: []` で対象プロパティの全キーが削除される
- `keyframeMode: merge` では宣言外の既存キーが保持される

## v0.10.0 実機確認項目

- active compを変えず、別compの `layers` / `expression-errors` / `properties` / `bounds` を取得できる
- comp名重複時は明示的にエラーになり、`compId` では一意に取得できる
- text / shape / footage / precompのboundsが2D親transformを含むcomp座標で取得できる
- nullや3Dなどbounds非対応レイヤーは誤った矩形を返さず明示的にエラーになる
- keyframe 0件・1件・複数件とlinear / bezier / hold、temporal easeを取得できる
- `layers` の `isNull` でnullと通常のsolidを区別できる

## v0.11.0 実機確認項目

- 1080×1920 compの任意時刻をフルサイズPNGへ出力できる
- `--scale 0.5` が540×960のPNGを返し、一時compがProjectに残らない
- active compとviewer tabが変わらない
- 出力失敗時に最終PNGと `.part.png` が残らない
- 既存出力を上書きせず、元ファイルを保持する
- snapshot前後でProjectのdirty状態やundo履歴に予期しない影響がないか確認する

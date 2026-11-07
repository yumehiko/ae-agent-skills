# py-aep検証版 実案件フィードバック 1

## 概要

- 日付: 2026-08-13
- 検証版: `0.14.0-pyaep.1`
- py-aep: `0.15.0`
- 環境: macOS 26.5.2 / After Effects 26.3.0
- 作業: 既存v2をテンプレートに、別案件v1の13カットを再構成し、テロップを差し替えた縦型22秒動画
- 結果: file pass / AE structure pass / visual passを完走、入力破壊・出力破損なし
- 体感: fast / low context

## 判断

py-aep中心の方式は「既存テンプレートを解析し、規則を数値化して量産する」作業で
現行方式より明確に優位だった。生成したPythonも次案件へ再利用できた。一方、異なる
プロジェクト間のcomp/layer/footageコピーがないため、複雑なキーフレーム・マスク・
effectを伴う素材移植は現時点の適用境界になる。

## 対応

| 項目 | 責務 | 方針 |
| --- | --- | --- |
| 派生AEPのキャッシュ汚染 | ae-agent-skills | P0。visual pass前の全RAM・ディスクcache purgeを必須化し、`ae-cli purge`を追加 |
| プロジェクト間コピー | py-aep upstream | P0。依存グラフとID再割当を伴う大型機能として先に仕様相談 |
| `Property.keyframes`の発見性 | py-aep upstream | P1。再現コード取得後、docs/便利propertyの小さいPRに分離 |
| `value_at_time()`例外 | upstream + skill | P1。`pre_expression=False`経路を明記し、誤診しにくい文言を提案 |
| `inspect_aep.py`の出力量 | ae-agent-skills | P1。`--brief`を追加 |
| skillバージョン不明 | ae-agent-skills | P1。SKILL.mdとUI表示へリリース番号を同期 |
| `bounds --time`のshape不整合 | ae-agent-skills | P1。bounds計算中だけ対象compの時刻を指定値へ切り替え、復元 |
| `layers --comp`の曖昧性 | ae-agent-skills | P2。`--comp-name`の明示aliasとして追加 |
| `project.items`反復で整数になる | skill/docs | P2。dict仕様と`.values()`、typed viewsを注意事項へ追加 |

## キャッシュ事象

派生AEPの一部フレームだけ前身プロジェクトの旧テキストが描画された。出力バイナリと
AE上のproperty値は正しく、同じ文字列のAE経由再設定後に解消した。comp/layer IDの
継承によるディスクキャッシュ衝突は有力仮説だが、原因断定はしない。運用上はpurge前の
snapshot/renderを検証証拠として扱わない。

## 次回比較で取る値

- 同型動画1本の総所要時間とagent tool往復回数
- `--brief`以外に作った探索スクリプト数
- project間コピー不能により手作業再構築したproperty数
- purge後の境界フレーム全数と描画差分
- 生成Pythonを次案件へ流用した際の修正行数

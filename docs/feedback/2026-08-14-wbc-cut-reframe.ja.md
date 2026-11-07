# py-aep検証版 実案件フィードバック 2

## 概要

- 日付: 2026-08-14
- 検証版: `0.14.0-pyaep.2`
- py-aep: `0.15.0`
- 作業: 3コンポ18カットの再選定、リタイム、横リフレーム
- 結果: file pass完走、入力SHA-256不変。素材理解が作業コストの7割強

## 判断

py-aepの読み書きはボトルネックではなかった。次の改善対象は、反復可能なカット表と
適用機構の分離、および単純な素材レイヤーに限定したオフラインeditorial proxyである。
ただしproxyはAEレンダリングの代替証拠ではなく、別のvalidation levelとして扱う。

## 対応

| 項目 | 方針 |
| --- | --- |
| EDL | 狭い`ae-agent-edl/v1`としてexport/applyを追加。汎用scene DSLにはしない |
| 視覚proxy | effects/masks/matte/3D等を拒否する限定実装。contact sheet、MP4、manifestを出力 |
| inspect | summaryを既定化し、briefへstart/stretch/transform、ID selector、outputを追加 |
| 複製 | cross-comp copyは親/matte付きで禁止。comp duplicateはAE検証必須 |
| API穴 | Solid名、None group、layer順、read-only ID、value APIをnotesへ追加 |
| 整理 | expression名参照監査と空folder限定削除を前提に強い用途として例示 |
| 出力名 | scratchと最終成果物を分離 |

## 上流切り分け

SolidSource-backed `FootageItem.name`の非永続化は最小例で再現した。`CompItem.duplicate()`
は最小例のpy-aep再parseでは親参照が正しいため、AE生成fixtureとAE open/renderを含む
再現が取れてから別Issueにする。`copy_to_comp()`の親/matte消去と自動suffixは現行仕様で、
バグと断定せず安全な高水準APIの要否を相談する。

追加追試では、py-aepで新規作成した親子レイヤーfixtureをAfter Effects 26.3x87の
独立`aerender`で描画した。元comp、duplicate、元comp削除後のduplicateはすべて復号後の
frame MD5が`2f18bf77755544b7e86d0e1cf2bf7a0b`で一致した。したがって一般的な
`duplicate()`不具合としてはIssue化せず、実案件から機密情報を除いた最小再現が得られるまで
保留する。

上流では、SolidSource renameを
[`forticheprod/py-aep#200`](https://github.com/forticheprod/py-aep/issues/200)として報告し、
cross-project import / dependency-aware layer copyは
[`#199`への設計提案](https://github.com/forticheprod/py-aep/issues/199#issuecomment-5288971149)
として投稿した。

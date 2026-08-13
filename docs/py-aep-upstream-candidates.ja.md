# py-aep upstream対応候補

実案件フィードバックから、`forticheprod/py-aep`側で扱うのが妥当な候補を管理する。
顧客AEPや素材は添付せず、各候補に最小再現AEP・再現コード・期待値を用意してから
IssueまたはPRを作成する。2026-08-13時点で該当する既存Issueは確認できていない。

## U1: プロジェクト間コピー / import

- 優先度: P0、仕様相談が先
- 問題: `Layer.copy_to_comp()`等は同一project内に限られ、別AEPのcomp/layer/footageと
  依存itemをtarget projectへ移せない。
- 望ましい最小単位: `source_comp.copy_to_project(target_project, include_dependencies=True)`
  のように依存comp/footage/folderを閉包としてコピーし、item ID・layer UID・source・
  parent・expression/Essential Graphics参照を再マップする。
- 判断: 単純なdeepcopyでは参照整合性を保証できない。upstreamの“What next?”
  Discussion/Issue #199で意味論を合意してから、footage-only、単一comp、依存閉包の順で
  分割実装する。
- 受入試験: nested comp、同名footage、parent、mask、effect、keyframe、expressionを含む
  小型fixtureをコピーし、save→reparse後の参照とAE openを検証する。

## U2: Property keyframe APIの発見性

- 優先度: P1、小さいPR候補
- 観測: 0.15.0の`Property`は`keyframes`をクラス注釈で宣言し、constructorでinstanceへ
  設定する。こちらの既存fixtureでは`'keyframes' in dir(prop)`はTrueだったため、報告と
  完全には一致しない。
- 方針: 問題のproperty型と正確な`dir()`コードを取得する。再現しない場合も
  `num_keys -> len(keyframes)` convenience propertyとdoc例は独立に提案可能。
- 受入試験: static/keyframed numeric、TextDocument、Shape、marker propertyで属性発見と
  key countを確認する。

## U3: `value_at_time()`の診断文

- 優先度: P1、小さいPR候補
- 現行: `pre_expression=False`だけが
  `Expression evaluation is not supported by the parser.`を送出する。通常の
  `value_at_time(time)`はstatic値またはkeyframe補間を返す。
- 方針: テキスト固有未対応とは断定しない。再現呼び出しを取得し、例外を
  ``pre_expression=False requests expression evaluation; only pre-expression values are supported``
  のように引数と回避方法が分かる文へ改善する。

## U4: 派生保存時のID再生成

- 優先度: 保留
- 目的: 前身projectと同じIDを持つ派生AEPのcache衝突回避。
- 判断: cache衝突の因果は未確定で、全参照の再マップはU1と同等に重い。ID変更自体が
  新たな破損を作る可能性があるため、先にae-agent-skills側のpurgeを標準運用して再発率を
  計測する。purgeで不足する再現例が得られた場合だけupstream設計を開始する。

## U5: `project.items`の反復API

- 優先度: P2、docs候補
- 現行: `project.items`はitem IDをキーとするdictなので、直接反復するとintになる。
- 方針: breaking changeは避け、`.values()`の利用と`project.compositions` /
  `project.footages`をdocsで強調する。必要なら型別iterator utilityを提案する。

## PR運用

1. U1は先にDiscussion、U2/U3/U5は独立Issueまたは独立PRにする。
2. py-aep main上で再現し、0.15.0固有かを切り分ける。
3. proprietary projectを使わず最小fixtureと回帰テストを添える。
4. upstream採択前はae-agent-skillsにfork patchを抱えず、skill上の回避策を維持する。

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

## U6: SolidSource-backed FootageItemのrename非永続化

- 状態: 解消（2026-09-01、py-aep 0.15.1）
- 上流: https://github.com/forticheprod/py-aep/issues/200
- 修正: https://github.com/forticheprod/py-aep/pull/209
- 再現: 新規projectへsolidを追加し、その`FootageItem.name`を変更してsave→reparseすると
  `SolidSource`内のsolid名へ戻る。代入直後のin-memory名だけが変更される。
- 確認: 同じ最小再現は0.15.0で失敗し、0.15.1で成功した。日本語名を使ったsolidと
  placeholderのsave→reparseも成功。ae-agent-skillsのPython 121件、Node 76件も通過した。

## U7: cross-comp `copy_to_comp()`の安全な意味論

- 優先度: P1、仕様相談
- 上流: https://github.com/forticheprod/py-aep/issues/199#issuecomment-5288971149
- 現行仕様: 別compへのcopyはparent/matteを消し、自動suffixを付ける。親ローカル座標が
  親なしで解釈されるため外観が変わり得る。
- 方針: 既存APIの破壊的変更は避ける。`preserve_world_transform`または依存レイヤーをまとめて
  copy/remapする新APIをIssue #199で相談する。skill側は親/matte付きcopyを拒否する。

## U8: `CompItem.duplicate()`のAE runtime参照不整合

- 優先度: 保留（実案件由来の最小再現待ち）
- 観測: 実案件でpy-aep再parse上は親参照が正しいのに、AEで親が効かず描画位置が壊れた。
- 現状: upstreamのroundtrip testはAE自身のduplicateとのchunk/参照graph比較を持つため、
  一般的なparent ID remap欠落とは断定できない。
- 方針: AE生成の最小fixtureで、元comp保持/削除の両方をsaveし、AE open後のparent ID、bounds、
  snapshotを比較する。再現したケースだけをfixture化してIssue/PRにする。
- 追試: py-aep新規fixtureをAE 26.3x87の独立`aerender`で検証し、元comp、duplicate、
  元comp削除後duplicateの復号frame MD5がすべて`2f18bf77755544b7e86d0e1cf2bf7a0b`で一致した。
  一般ケースでは再現しないためIssue化せず、実案件由来の最小再現を待つ。

## PR運用

1. U1は先にDiscussion、U2/U3/U5は独立Issueまたは独立PRにする。
2. 採用中のpy-aepリリースとcurrent mainの両方で再現し、リリース固有かを切り分ける。
3. proprietary projectを使わず最小fixtureと回帰テストを添える。
4. upstream採択前はae-agent-skillsにfork patchを抱えず、skill上の回避策を維持する。

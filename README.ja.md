# ae-agent-skills

`.aep`をPythonオブジェクトとして一括編集する、オフライン優先のワークフローです。
`py-aep`、runtime確認用After Effects拡張、agent skillを導入します。

English README: [README.md](README.md)

## クイックスタート

1. インストールする。

```bash
npx --yes ae-agent-skills@latest install
```

2. After Effectsを再起動し、`ウィンドウ > 機能拡張 (ベータ) > ae-agent-skill`を開く。
3. エージェントを起動し、対象`.aep`のオフライン編集を依頼する。

```text
$aftereffects-py-aep を使って、/path/to/input.aep のMainコンポにタイトルを追加し、
/path/to/output.aepへ別名保存して再parse検証して。
```

Claude Codeでは`$aftereffects-py-aep`の代わりに`/aftereffects-py-aep`を使用します。

## 検証方針

- file編集は`py-aep`を直接使い、一度parseして一度saveする
- 入力`.aep`を上書きせず、出力を再parseして意味的に検証する
- snapshot、式評価、text/shape boundsなどruntime依存の確認だけ`ae-cli`を使う
- [同梱のフィードバックテンプレート](skills/aftereffects-py-aep/references/preview-feedback.ja.md)を案件内にコピーして結果を記録する

固定依存を py-aep 0.19.0 に更新し、0.15.1 で再現したキー時刻・イージングの上流不具合を解消した。アニメーションの確定前には AE 上と保存・再読込後の検証を行う。[最小再現と例外時の native フォールバック](skills/aftereffects-py-aep/references/keyframe-verification.md)を参照。

## アップデート

After Effectsを終了してから、インストール済みのエージェントを指定して実行します。

```bash
npx --yes ae-agent-skills@latest install --agent codex
```

`codex`は`gemini`、`claude`、または`all`へ置き換えられます。完了後にAfter Effectsを再起動してください。

## 0.13 からの移行

0.14 は従来の宣言型・mutationスキルを `aftereffects-py-aep` に置き換えます。
実機検証用CLIは引き続き利用できます。案件のスクリプトやAEPを自動で書き換えることはありません。

旧ワークフローへ戻す場合は、導入先の `aftereffects-py-aep` スキルを削除し、
`ae-agent-skills@0.13.0` を明示してインストールしてください。`latest` はpy-aep版になります。

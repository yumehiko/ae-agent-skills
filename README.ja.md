# ae-agent-skills

> このブランチは `py-aep` 検証版です。安定版の宣言型・mutation CLIではなく、
> `.aep`をPythonオブジェクトとして一括編集する実作業評価を目的とします。

検証版は`py-aep`、runtime確認用After Effects拡張、薄いagent skillを導入します。

English README: [README.md](README.md)

## クイックスタート

1. インストールする。

```bash
npx --yes ae-agent-skills@pyaep install
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
- `~/ae-agent-skills-preview/feedback-template.ja.md`へ実案件の結果を記録する

## アップデート

After Effectsを終了してから、インストール済みのエージェントを指定して実行します。

```bash
npx --yes ae-agent-skills@pyaep install --agent codex
```

`codex`は`gemini`、`claude`、または`all`へ置き換えられます。完了後にAfter Effectsを再起動してください。

安定版へ戻す場合は`~/.agents/skills/aftereffects-py-aep`を削除してから、
`npx --yes ae-agent-skills@latest install --agent codex`を実行します。

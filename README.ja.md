# ae-agent-skills

`ae-agent-skills`は、Codex、Gemini、Claude CodeからAdobe After Effectsを操作するためのツールです。
After Effects拡張、`ae-cli`、エージェント向けskillを1コマンドで導入できます。

English README: [README.md](README.md)

## クイックスタート

1. インストールする。

```bash
npx ae-agent-skills install
```

2. After Effectsを再起動し、`ウィンドウ > 機能拡張 (ベータ) > ae-agent-skill`を開く。
3. エージェントを起動し、After Effectsの操作を依頼する。

```text
$aftereffects-declarative を使って、1920x1080 / 30fps / 5秒のコンポジションを作成して。
背景はダークグレー、中央に「Hello AE Agent」のテキストを配置し、
0.5秒でフェードインするアニメーションを追加して。
```

Claude Codeでは`$aftereffects-declarative`の代わりに`/aftereffects-declarative`を使用します。

## skillの使い分け

- `$aftereffects-declarative`: 新規コンポジションや、再実行可能なシーン全体の編集。通常はこちらを使用します。
- `$aftereffects-cli`: 既存シーンの局所的な調整やデバッグに使用します。

## アップデート

After Effectsを終了してから、インストール済みのエージェントを指定して実行します。

```bash
npx --yes ae-agent-skills@latest install --agent codex
```

`codex`は`gemini`、`claude`、または`all`へ置き換えられます。完了後にAfter Effectsを再起動してください。

## ドキュメント

- [CLI利用方法](docs/cli.ja.md)
- [開発者向け情報](docs/development.ja.md)

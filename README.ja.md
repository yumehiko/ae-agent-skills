# ae-agent-skills

`ae-agent-skill`（After Effects CEP パネル）、`ae-cli`、Codex/Gemini 向け skill を1コマンドで導入するリポジトリです。

English README: [README.md](README.md)

## インストール（clone不要）

```bash
npx ae-agent-skills install
```

実行内容:

1. `--agent` 未指定なら、`codex` / `gemini` / `both` の選択を表示します。
2. 署名済み ZXP を `UPIA` または `ExManCmd` でインストールします。
3. `ae-cli` と agent skill をインストールします。
4. `~/ae-agent-skills/` を初期化し、`work/`・`done/`・`scene.schema.json`・`references/` を配置します。

## エージェントで実行

導入後:

1. After Effects を再起動する。
2. `ウィンドウ > 機能拡張 (ベータ) > ae-agent-skill` を開く。
3. コーディングエージェントで以下の skill を呼び出す。
- `$aftereffects-declarative`（通常の構成作成向け）
- `$aftereffects-cli`（個別編集・デバッグ向け）

## ドキュメント

- CLI利用方法: [docs/cli.ja.md](docs/cli.ja.md)
- 開発者向け情報: [docs/development.ja.md](docs/development.ja.md)
- 宣言型 skill 本体: [.codex/skills/aftereffects-declarative/SKILL.md](.codex/skills/aftereffects-declarative/SKILL.md)
- レガシーCLI skill 本体: [.codex/skills/aftereffects-cli/SKILL.md](.codex/skills/aftereffects-cli/SKILL.md)

# ae-agent-skills

`ae-agent-skills`は、コーディングエージェント（Codex / Gemini）からAdobe After Effectsを操作できるようにするためのリポジトリです。
`ae-agent-skill`（After Effects CEP パネル）、`ae-cli`、エージェント向け skill を導入し、コンポジション作成や既存シーン編集をエージェントに依頼できるようになります。

English README: [README.md](README.md)

## クイックスタート

1. インストールする。

```bash
npx ae-agent-skills install
```

2. After Effects を再起動し、`ウィンドウ > 機能拡張 (ベータ) > ae-agent-skill` を開く。
3. Codex または Gemini を起動し、After Effects操作を依頼する。

最初の依頼例（コンポジション作成）:

```text
$aftereffects-declarative を使って、1920x1080 / 30fps / 5秒のコンポジションを作成して。
背景はダークグレー、中央に「Hello AE Agent」のテキストを配置し、
0.5秒でフェードインするアニメーションを追加して。
```

4. エージェントの処理完了後、After Effects 上でコンポジションが作成されたことを確認する。

## インストール時に行われること

1. `--agent` 未指定なら、`codex` / `gemini` / `both` の選択を表示します。
2. 署名済み ZXP を `UPIA` または `ExManCmd` でインストールします。
3. `ae-cli` と agent skill をインストールします。
4. `~/ae-agent-skills/` を初期化し、`work/`・`done/`・`scene.schema.json`・`references/` を配置します。

## どの skill を使うか

- `$aftereffects-declarative`: 新規コンポジション作成や全体構成を作るとき（通常はこちら）
- `$aftereffects-cli`: 既存シーンの一部修正、プロパティ単位の調整、デバッグ

## ドキュメント

- CLI利用方法: [docs/cli.ja.md](docs/cli.ja.md)
- 開発者向け情報: [docs/development.ja.md](docs/development.ja.md)
- 宣言型 skill 本体: [.codex/skills/aftereffects-declarative/SKILL.md](.codex/skills/aftereffects-declarative/SKILL.md)
- レガシーCLI skill 本体: [.codex/skills/aftereffects-cli/SKILL.md](.codex/skills/aftereffects-cli/SKILL.md)

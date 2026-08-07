# ae-agent-skills

`ae-agent-skills`は、コーディングエージェント（Codex / Gemini / Claude Code）からAdobe After Effectsを操作できるようにするためのリポジトリです。
`ae-agent-skill`（After Effects CEP パネル）、`ae-cli`、エージェント向け skill を導入し、コンポジション作成や既存シーン編集をエージェントに依頼できるようになります。

English README: [README.md](README.md)

## クイックスタート

1. インストールする。

```bash
npx ae-agent-skills install
```

2. After Effects を再起動し、`ウィンドウ > 機能拡張 (ベータ) > ae-agent-skill` を開く。
3. Codex、Gemini、または Claude Code を起動し、After Effects操作を依頼する。

最初の依頼例（コンポジション作成）:

```text
$aftereffects-declarative を使って、1920x1080 / 30fps / 5秒のコンポジションを作成して。
背景はダークグレー、中央に「Hello AE Agent」のテキストを配置し、
0.5秒でフェードインするアニメーションを追加して。
```

Claude Code では slash command として呼び出します。

```text
/aftereffects-declarative を使って、1920x1080 / 30fps / 5秒のコンポジションを作成して。
背景はダークグレー、中央に「Hello AE Agent」のテキストを配置し、
0.5秒でフェードインするアニメーションを追加して。
```

4. エージェントの処理完了後、After Effects 上でコンポジションが作成されたことを確認する。

フッテージ編集の依頼例:

```text
$aftereffects-declarative を使って interview.mp4 の12.5〜18秒と25〜31秒を抜き出し、
順番に並べたコンポジションを作成して。
```

`v0.4.0` からファイル素材のimport・再利用・複数カット配置に対応し、`v0.5.0` では
音量、ミュート、フェードイン／アウトを各カットへ設定できます。`v0.6.0` では
フォント、サイズ、塗り、線、字間、行間、揃えをテキストレイヤーへ設定できます。

エージェントを明示してインストールする場合:

```bash
npx ae-agent-skills install --agent codex
npx ae-agent-skills install --agent gemini
npx ae-agent-skills install --agent claude
npx ae-agent-skills install --agent all
```

## インストール時に行われること

1. `--agent` 未指定なら、`codex` / `gemini` / `claude` / `both` / `all` の選択を表示します。
2. 署名済み ZXP を `UPIA` または `ExManCmd` でインストールします。
3. `ae-cli` と agent skill をインストールします。
4. `~/ae-agent-skills/` を初期化し、`work/`・`done/`・`scene.schema.json`・`references/` を配置します。

`both` は後方互換のため Codex + Gemini、`all` は Codex + Gemini + Claude Code です。
Claude Code の個人 skill は `~/.claude/skills/<skill-name>/SKILL.md` にインストールされます。
Claude Code 用の slash command は `~/.claude/commands/<command>.md` にインストールされます。

## アップデート

1. After Effectsのプロジェクトを保存し、After Effectsを終了する。
2. インストール時と同じエージェントを指定して、最新版のインストーラーを実行する。

```bash
npx --yes ae-agent-skills@latest install --agent codex
```

複数のエージェントをまとめて更新する場合:

```bash
npx --yes ae-agent-skills@latest install --agent all
```

3. After Effectsを再起動し、`ウィンドウ > 機能拡張 (ベータ) > ae-agent-skill` を開く。
4. 疎通を確認する。

```bash
ae-cli health
```

アップデートでは、CEP拡張機能、`ae-cli`、agent skill、`scene.schema.json`、`references/` が最新版へ更新されます。
`~/ae-agent-skills/work/` と `~/ae-agent-skills/done/` に保存した作業ファイルは削除されません。

## どの skill を使うか

- `$aftereffects-declarative`: 新規コンポジション作成、全体構成、再実行可能なフッテージ・音声・テキスト編集（通常はこちら）
- `$aftereffects-cli`: 既存シーンへの素材追加、音声やテキストの局所調整、プロパティ単位の修正、デバッグ

## ドキュメント

- CLI利用方法: [docs/cli.ja.md](docs/cli.ja.md)
- 開発者向け情報: [docs/development.ja.md](docs/development.ja.md)
- 宣言型 skill 本体: [templates/skills/aftereffects-declarative.SKILL.md](templates/skills/aftereffects-declarative.SKILL.md)
- CLI skill 本体: [templates/skills/aftereffects-cli.SKILL.md](templates/skills/aftereffects-cli.SKILL.md)

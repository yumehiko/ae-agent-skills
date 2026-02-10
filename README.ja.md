# ae-agent-skills

After Effects の CEP HTTP ブリッジを、MCP 非依存で操作するためのリポジトリです。

English README は [README.md](README.md) を参照してください。

## Quick Links

- English README: [README.md](README.md)
- 日本語 README: [README.ja.md](README.ja.md)
- Onboarding skill: [.codex/skills/aftereffects-onboarding/SKILL.md](.codex/skills/aftereffects-onboarding/SKILL.md)
- CLI skill: [.codex/skills/aftereffects-cli/SKILL.md](.codex/skills/aftereffects-cli/SKILL.md)

## このリポジトリでできること

- `ae-cli` で以下を実行
  - レイヤー/プロパティ取得
  - expression 適用
  - エフェクト追加
- Codex/Gemini 向け skill を同梱
  - `.codex/skills/aftereffects-cli/SKILL.md`
  - `.codex/skills/aftereffects-onboarding/SKILL.md`

## 前提

- macOS
- Adobe After Effects（CEP 拡張が動作する環境）
- Python 3.10+

### CEP Debug 設定（未署名拡張向け）

このリポジトリの拡張は開発用途を想定しているため、環境によっては `PlayerDebugMode=1` が必要です。

```bash
defaults domains | tr ',' '\n' | rg 'com\.adobe\.CSXS\.'
# 例: com.adobe.CSXS.11 が見つかった場合
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

設定後は After Effects を完全終了して再起動してください。

## クイックスタート（推奨）

エージェントに onboarding を依頼してください。

依頼例:

- `このリポジトリで aftereffects-onboarding を進めて。`
- `Please run aftereffects-onboarding for this repository.`

onboarding では次を段階的に確認します。

- CEP extension の配置/リンク
- Python 仮想環境構築
- `pip install -e .`
- ブリッジ疎通確認（`ae-cli health`, `ae-cli layers`）

## クローン

```bash
git clone https://github.com/yumehiko/ae-agent-skills.git
cd ae-agent-skills
```

## 手動で CLI を使う場合

```bash
ae-cli --help
ae-cli health
ae-cli layers
ae-cli selected-properties
ae-cli properties --layer-id 1 --max-depth 3
ae-cli set-expression --layer-id 1 --property-path "Transform > Position" --expression "wiggle(2,30)"
ae-cli add-effect --layer-id 1 --effect-match-name "ADBE Slider Control" --effect-name "Speed"
```

`ae-cli` が `PATH` にない場合は、次で実行できます。

```bash
PYTHONPATH=src python3 -m ae_cli.main --help
```

`--base-url` 未指定時は `AE_BRIDGE_URL`、なければ `http://127.0.0.1:8080` を使用します。

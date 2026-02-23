# 開発者向け情報

## ローカル開発の前提

- macOS
- Adobe After Effects（CEP対応環境）
- Python 3.10+

## 未署名ローカル開発モード

未署名拡張で開発する場合は `PlayerDebugMode=1` を有効化します。

```bash
defaults domains | tr ',' '\n' | rg 'com\.adobe\.CSXS\.'
# 例: com.adobe.CSXS.11 の場合
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

設定後は After Effects を完全終了して再起動してください。

## Python開発セットアップ

```bash
python3 -m pip install -e ".[dev]"
PYTHONPATH=src pytest
```

## ZXPビルドと公開手順

`0.2.6` 以降は `package.json` の `version` を正として、`npm version` 実行時に `CSXS/manifest.xml` へ自動同期します。

### 1) バージョン更新

```bash
npm version 0.2.7 --no-git-tag-version
```

### 2) 署名付き ZXP ビルド

前提:
- `ZXPSignCmd` が `PATH` 上にある、または `ZXPSIGNCMD_BIN` で実体パスを指定できる
- 署名証明書 (`.p12`) とパスワードを用意済み

1コマンド（パスワードはプロンプト入力）:

```bash
npm run build:zxp
```

または:

```bash
./scripts/signing/build-zxp-interactive.sh
```

証明書パスを変える場合:

```bash
SIGN_CERT_P12=/absolute/path/to/dev-cert.p12 npm run build:zxp
```

以下は従来どおり、環境変数で直接指定する方法:

```bash
SIGN_CERT_P12=certs/dev-cert.p12 \
SIGN_CERT_PASSWORD='your-password' \
./scripts/signing/build-zxp.sh
```

必要なら `ZXPSIGNCMD_BIN` を指定:

```bash
ZXPSIGNCMD_BIN=/absolute/path/to/ZXPSignCmd \
SIGN_CERT_P12=certs/dev-cert.p12 \
SIGN_CERT_PASSWORD='your-password' \
./scripts/signing/build-zxp.sh
```

出力先:
- `dist/ae-agent-skill-<version>.zxp`

### 3) コミット・タグ・push

```bash
git add package.json CSXS/manifest.xml
git commit -m "release: v0.2.7"
git tag v0.2.7
git push origin HEAD
git push origin v0.2.7
```

### 4) npm 公開

```bash
npm publish
```

### 5) GitHub Release 作成（ZXP添付）

`npx ae-agent-skills install` は latest release の `.zxp` を参照するため、Release に ZXP を添付します。

```bash
gh release create v0.2.7 dist/ae-agent-skill-0.2.7.zxp \
  --title v0.2.7 \
  --notes "Release notes"
```

### 6) 公開後確認

```bash
npm view ae-agent-skills version dist-tags.latest --json
gh release view --repo yumehiko/ae-agent-skills --json tagName,assets
```

## プロジェクト構成

### Python CLI

- `src/ae_cli/cli_parser.py`
- `src/ae_cli/cli_runner.py`
- `src/ae_cli/client.py`
- `src/ae_cli/main.py`

### ExtendScript host

- `host/index.jsx`
- `host/lib/common.jsx`
- `host/lib/property_utils.jsx`
- `host/lib/query_handlers.jsx`
- `host/lib/mutation_handlers.jsx`
- `host/lib/mutation_keyframe_handlers.jsx`
- `host/lib/mutation_shape_handlers.jsx`
- `host/lib/mutation_timeline_handlers.jsx`
- `host/lib/mutation_layer_structure_handlers.jsx`
- `host/lib/mutation_scene_handlers.jsx`

### CEP panel client

- `client/main.js`
- `client/lib/runtime.js`
- `client/lib/logging.js`
- `client/lib/bridge_utils.js`
- `client/lib/request_handlers_shape.js`
- `client/lib/request_handlers_scene.js`
- `client/lib/request_handlers_essential.js`
- `client/lib/request_handlers_timeline.js`
- `client/lib/request_handlers_layer_structure.js`
- `client/lib/request_handlers.js`
- `client/lib/server.js`

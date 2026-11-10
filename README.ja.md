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

## コードで書くジェネラティブ表現

HTML / Canvas / SVG / WebGLで書いた表現をPNG連番にレンダーし、AEPへ取り込めます。
既存の `aftereffects-py-aep` スキルの基本機能であり、追加のAEプラグインは不要です。
出力はAEネイティブのshapeではなくラスター映像です。AE上のレイヤー、transform、
effectは編集でき、絵自体の変更は保存したソースコードを編集して再レンダーします。

```bash
ae-generative render /path/to/scene --output /path/to/new-render
```

インストーラーが `~/.local/share/ae-agent-skills/` に専用Python環境を作り、
py-aep・Playwright・Chromiumを導入します。`pip --user` は使わず、Homebrewや
システムPythonのパッケージを変更しません。Python 3.10以上（venv付き）とNode.js 18以上が必要です。

```bash
export PATH="$HOME/.local/share/ae-agent-skills/bin:$PATH"
# py-aepの案件スクリプトも、このPythonで実行する
"$HOME/.local/share/ae-agent-skills/bin/python" /path/to/task.py
```

同じ `bin` 内に `ae-cli` と `ae-generative` があります。PATHを変更せず絶対パスで
呼ぶこともできます。PATH変更後はエージェントを再起動してください。既存のpip版CLIは
削除しないため、上記ディレクトリを古いPythonのbinより前に置いてください。

パッケージ更新に失敗した場合は、以前の正常な環境を維持します。Chromiumのダウンロードに
失敗してもCLI・スキルの導入は続け、ブラウザのセットアップ未完了を明示します。
`ae-generative setup` またはインストーラーに `--skip-extension` を付けて再実行できます。
`--skip-cli` はPython環境・ブラウザの導入を省略します。pip・スキル単体の利用者は
自分のvenvを作り、そのPythonでChromiumも導入してください。

拡張を含む標準導入・AE実機検証はmacOSが対象です。Linuxでは `--skip-extension` で
オフラインPython・ブラウザ処理を使えますが、PlaywrightのOSライブラリが別途必要な場合が
あります。npmインストーラーはWindows非対応です。初回導入にはGitHub・PyPI・Playwrightの
ダウンロード先への接続が必要で、レンダー時の素材はローカルのみを使用します。
新規の環境・ブラウザ用に約1 GB、さらにPNG連番と保持される旧環境分の容量を確保してください。
ブラウザ本体はnpm/ZXPには同梱せず、導入時に取得します。[依存ライセンス](THIRD_PARTY_NOTICES.md)も参照してください。

専用Chromiumがなければエラーにし、別ブラウザは `--browser` で明示したときだけ使います。
再現性の保証は同じブラウザ・runtime・フォント・ローカル入力の範囲です。
信頼できるローカルコードだけを実行してください。

manifest、フレームAPI、ソース保存、alpha、py-aepへの取り込みは
[ジェネラティブのワークフロー](skills/aftereffects-py-aep/references/generative-workflow.md)を参照。

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

# ae-agent-skills

Codex、Gemini、Claude Codeから[`py-aep`](https://github.com/forticheprod/py-aep)を使って
After Effectsプロジェクトを編集できます。スキル、Python環境、`ae-cli`、
`ae-generative`、After Effects拡張をまとめてインストールします。

English: [README.md](README.md)

## インストール

Node.js 18以上とPython 3.10以上（`venv`付き）が必要です。拡張を含むインストールは
macOSに対応しています。Linuxでオフライン編集・レンダーを使う場合は
`--skip-extension`を付けてください。npmインストーラーはWindows非対応です。

```bash
npx --yes ae-agent-skills@latest install --agent codex
```

`codex`は`gemini`、`claude`、`all`に置き換えられます。PythonパッケージとChromiumは
`~/.local/share/ae-agent-skills/`にダウンロードされます。

起動中のAfter Effectsを操作する場合は、After Effectsを再起動し、
`ウィンドウ > 機能拡張 (ベータ) > ae-agent-skill`を開いてください。

## 使い方

エージェントを起動して、編集内容を依頼します。

```text
$aftereffects-py-aep を使って、/path/to/input.aep のMainコンポにタイトルを追加し、
/path/to/output.aep に別名保存して。
```

Claude Codeでは`$aftereffects-py-aep`の代わりに`/aftereffects-py-aep`を使います。

HTML・Canvas・SVG・WebGLでアニメーションを作る場合:

```text
$aftereffects-py-aep を使って、アイコンが浮遊する5秒のアニメーションをCanvasで作り、
PNG連番にレンダーして /path/to/input.aep のMainコンポに追加して。
/path/to/output.aep に別名保存して。
```

コマンドを直接使う場合は、以下のPATHを設定してエージェントを再起動してください。

```bash
export PATH="$HOME/.local/share/ae-agent-skills/bin:$PATH"
ae-generative render /path/to/scene --output /path/to/new-render
"$HOME/.local/share/ae-agent-skills/bin/python" /path/to/task.py
```

シーンは[サンプル](skills/aftereffects-py-aep/assets/generative/floating-icons)を元に作成できます。
出力先には新しいディレクトリを指定し、信頼できるローカルコードだけを実行してください。
映像を変更するときはソースを編集して再レンダーします。
Chromiumの導入に失敗した場合は`ae-generative setup`を実行してください。

## アップデート

After Effectsを終了し、使用中のエージェントを指定してインストールコマンドを再実行します。
完了後にAfter Effectsを再起動してください。

## ドキュメント

- [スキルの使い方](skills/aftereffects-py-aep/SKILL.md)
- [ジェネラティブのレンダーとAEPへの取り込み](skills/aftereffects-py-aep/references/generative-workflow.md)
- [実機操作用CLI](docs/cli.md)
- [依存ライセンス](THIRD_PARTY_NOTICES.md)

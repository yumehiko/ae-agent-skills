---
name: aftereffects-onboarding
description: `ae-agent-skills` の初期導入を対話で進める手順。`ae-cli` 未導入や CEP 配置未完了の状態から、疎通確認まで段階的に案内する依頼で使う。
---

# aftereffects-onboarding

`ae-agent-skills` の初期導入を、ユーザーとの対話で完了まで補助する。

## 基本方針

1. 1ステップずつ進め、各ステップでユーザー確認を取る。
2. エージェントが実行可能なコマンドは実行して結果を示す。
3. GUI 操作（After Effects 起動、パネル表示）はユーザー依頼に切り替える。
4. 権限が必要な操作（`/Library/...` への配置など）は回避せず、ユーザーに実行依頼する。

## 対話フロー

### Step 1: リポジトリ位置の確認

- ユーザーに `ae-agent-skills` のローカルパスを確認する。
- 以降のコマンドはそのパスを `cwd` として扱う。

### Step 2: CEP extensions への配置確認

- まずユーザー領域を案内する:
  - `~/Library/Application Support/Adobe/CEP/extensions`
- 未配置なら次を案内する:
  - `ln -s "<repo-path>" "$HOME/Library/Application Support/Adobe/CEP/extensions/llm-video-agent"`
- 既存リンクやディレクトリがある場合:
  - 中身がこのリポジトリか確認させる。
  - 不一致ならユーザーに整理方針を選んでもらう（置換または別名）。

### Step 3: Python 環境と CLI 導入

- `python3 --version` を確認する。
- 仮想環境がなければ作成する:
  - `python3 -m venv .venv`
- 有効化してインストールする:
  - `source .venv/bin/activate`
  - `pip install -e .`
- 動作確認する:
  - `ae-cli --help`

### Step 4: After Effects 側起動

- 未署名 CEP 拡張を使う前提として、`PlayerDebugMode=1` を確認/設定する。
  - `defaults domains | tr ',' '\n' | rg 'com\.adobe\.CSXS\.'`
  - 使用中の `com.adobe.CSXS.<version>` に対して:
    - `defaults write com.adobe.CSXS.<version> PlayerDebugMode 1`
  - 設定後は After Effects を完全終了して再起動する。
- ユーザーに依頼する:
  1. After Effects を起動する。
  2. `ウィンドウ > 機能拡張 (ベータ) > LLM Video Agent` を開く。
- パネル表示後、ブリッジ待受中か確認するよう依頼する。

### Step 5: 疎通確認

- エージェント実行:
  - `ae-cli health`
- 成功時:
  - `ae-cli layers` を実行し、結果取得できるか確認する。
  - 可能なら新規コマンドの最小スモークテストを行う。
    - `ae-cli list-comps`
    - `ae-cli create-comp --name "OnboardingSmoke" --width 1080 --height 1080 --duration 3 --frame-rate 30`
    - `ae-cli set-active-comp --comp-name "OnboardingSmoke"`
    - `ae-cli add-layer --layer-type text --name "SmokeText" --text "Hello"`
    - `ae-cli set-property --layer-id 1 --property-path "ADBE Transform Group.ADBE Position" --value "[540,540]"`
    - `ae-cli set-keyframe --layer-id 1 --property-path "ADBE Transform Group.ADBE Position" --time 0 --value "[540,540]"`
    - `ae-cli set-keyframe --layer-id 1 --property-path "ADBE Transform Group.ADBE Position" --time 1 --value "[540,300]" --in-interp bezier --out-interp bezier --ease-in "[0,80]" --ease-out "[0,40]"`
- 失敗時:
  - `PlayerDebugMode` が有効か再確認する。
  - パネルを再起動する。
  - `AE_BRIDGE_URL` と `--base-url` の整合を確認する。
  - `127.0.0.1:8080` 使用プロセス競合を確認する（必要なら `lsof -i :8080` を依頼）。

## 完了条件

次を満たしたら初期導入完了と判断する。

1. `ae-cli --help` が表示できる。
2. `ae-cli health` が成功する。
3. `ae-cli layers` が成功する。
4. （推奨）`list-comps` / `create-comp` / `set-active-comp` / `set-property` / `set-keyframe` の最低1回実行が成功する。

## 完了時の案内

- 通常操作は `aftereffects-declarative` skill を使うよう案内する。
- 命令型での個別編集が必要な場合のみ `aftereffects-cli-legacy` skill を使うよう案内する。
- 現状この skill を利用するには、このリポジトリを `cwd` にする必要があると案内する。
- グローバルに利用したい場合は、`$CODEX_HOME/skills` への導入希望を伝えてもらうよう案内する。
- 最初の操作例として以下を提示する。

```bash
ae-cli list-comps
ae-cli create-comp --name "Main" --width 1920 --height 1080 --duration 8 --frame-rate 30
ae-cli set-active-comp --comp-name "Main"
ae-cli selected-properties
ae-cli properties --layer-id 1 --max-depth 2
ae-cli set-property --layer-id 1 --property-path "ADBE Transform Group.ADBE Position" --value "[960,540]"
ae-cli set-keyframe --layer-id 1 --property-path "ADBE Transform Group.ADBE Position" --time 0.5 --value "[960,540]"
ae-cli set-keyframe --layer-id 1 --property-path "ADBE Transform Group.ADBE Position" --time 1.0 --value "[960,300]" --in-interp bezier --out-interp bezier --ease-in "[0,80]" --ease-out "[0,40]"
```

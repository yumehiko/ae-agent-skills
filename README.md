# ae-agent-skills

Edit After Effects projects with Codex, Gemini, or Claude Code using
[`py-aep`](https://github.com/forticheprod/py-aep). The installer includes the agent
skill, Python environment, `ae-cli`, `ae-generative`, and After Effects extension.

日本語: [README.ja.md](README.ja.md)

## Install

Requires Node.js 18+ and Python 3.10+ with `venv`. Full installation supports macOS;
on Linux, add `--skip-extension` for offline editing and rendering. The npm installer
does not support Windows.

```bash
npx --yes ae-agent-skills@latest install --agent codex
```

Replace `codex` with `gemini`, `claude`, or `all`. The installer downloads the Python
packages and Chromium into `~/.local/share/ae-agent-skills/`.

For live After Effects operations, restart After Effects and open
`Window > Extensions (Beta) > ae-agent-skill`.

## Usage

Launch your agent and describe the edit:

```text
Use $aftereffects-py-aep to add a title to the Main composition in
/path/to/input.aep and save it as /path/to/output.aep.
```

In Claude Code, use `/aftereffects-py-aep` instead of `$aftereffects-py-aep`.

To create animation from HTML, Canvas, SVG, or WebGL:

```text
Use $aftereffects-py-aep to create a 5-second floating-icons animation in Canvas,
render it as a PNG sequence, and add it to the Main composition in
/path/to/input.aep. Save it as /path/to/output.aep.
```

To run commands directly, add the installed launchers to your PATH and restart your agent:

```bash
export PATH="$HOME/.local/share/ae-agent-skills/bin:$PATH"
ae-generative render /path/to/scene --output /path/to/new-render
"$HOME/.local/share/ae-agent-skills/bin/python" /path/to/task.py
```

Start your scene from the [example](skills/aftereffects-py-aep/assets/generative/floating-icons).
Use a new output directory and trusted local code. To change the rendered artwork,
edit the scene source and render again. If Chromium setup failed, run `ae-generative setup`.

## Update

Quit After Effects and rerun the install command for your agent, then restart After Effects.

## Documentation

- [Skill usage](skills/aftereffects-py-aep/SKILL.md)
- [Generative rendering and AEP import](skills/aftereffects-py-aep/references/generative-workflow.md)
- [Live AE CLI](docs/cli.md)
- [Third-party licenses](THIRD_PARTY_NOTICES.md)

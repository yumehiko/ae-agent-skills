"""Portable version-sync tests: do not depend on the maintainer's private release skill."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    'package.json', 'pyproject.toml', 'CSXS/manifest.xml',
    '.codex-plugin/plugin.json', 'skills/aftereffects-py-aep/SKILL.md',
    'skills/aftereffects-py-aep/agents/openai.yaml',
    'scripts/release/sync-version.mjs',
]


@pytest.mark.parametrize('version,python,cep,label', [
    ('1.2.3', '1.2.3', '1.2.3', 'Release'),
    ('0.14.0-pyaep.7', '0.14.0.dev7', '0.14.0.pyaep-7', 'Preview release'),
])
def test_release_version_sync(tmp_path: Path, version: str, python: str, cep: str, label: str) -> None:
    for relative in FILES:
        target = tmp_path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, target)
    package = tmp_path / 'package.json'
    data = json.loads(package.read_text())
    data['version'] = version
    package.write_text(json.dumps(data))
    subprocess.run(['node', str(tmp_path/'scripts/release/sync-version.mjs')], check=True, capture_output=True)
    assert json.loads((tmp_path/'.codex-plugin/plugin.json').read_text())['version'] == version
    assert f'version = "{python}"' in (tmp_path/'pyproject.toml').read_text()
    assert f'ExtensionBundleVersion="{cep}"' in (tmp_path/'CSXS/manifest.xml').read_text()
    assert f'{label}: `ae-agent-skills@{version}`' in (tmp_path/'skills/aftereffects-py-aep/SKILL.md').read_text()
    agent = (tmp_path/'skills/aftereffects-py-aep/agents/openai.yaml').read_text()
    expected = 'After Effects py-aep' + (' Preview' if label=='Preview release' else '')
    assert f'display_name: "{expected} {version}"' in agent


def test_current_stable_versions_are_synchronized() -> None:
    assert json.loads((ROOT/'package.json').read_text())['version'] == '0.14.0'
    assert json.loads((ROOT/'.codex-plugin/plugin.json').read_text())['version'] == '0.14.0'
    assert 'version = "0.14.0"' in (ROOT/'pyproject.toml').read_text()
    assert 'ExtensionBundleVersion="0.14.0"' in (ROOT/'CSXS/manifest.xml').read_text()

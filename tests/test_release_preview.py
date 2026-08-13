from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / ".agents/skills/release-ae-agent-skills/scripts/release.py"
SPEC = importlib.util.spec_from_file_location("release_ae_agent_skills", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)


def test_stable_release_coordinates() -> None:
    assert release.release_coordinates("1.2.3") == {
        "version": "1.2.3",
        "pythonVersion": "1.2.3",
        "cepVersion": "1.2.3",
        "branch": "main",
        "prerelease": False,
        "npmDistTag": "latest",
    }


def test_pyaep_preview_release_coordinates() -> None:
    assert release.release_coordinates("0.14.0-pyaep.7") == {
        "version": "0.14.0-pyaep.7",
        "pythonVersion": "0.14.0.dev7",
        "cepVersion": "0.14.0.pyaep-7",
        "branch": "preview/py-aep",
        "prerelease": True,
        "npmDistTag": "pyaep",
    }


def test_current_preview_versions_are_synchronized() -> None:
    coordinates = release.require_version_sync(ROOT)
    assert coordinates["version"] == "0.14.0-pyaep.1"
    assert coordinates["branch"] == "preview/py-aep"

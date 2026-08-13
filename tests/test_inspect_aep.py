from __future__ import annotations

import importlib.util
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "skills/aftereffects-py-aep/scripts/inspect_aep.py"
SPEC = importlib.util.spec_from_file_location("inspect_aep", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
inspect_aep = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(inspect_aep)


def test_brief_layer_data_keeps_only_requested_fields() -> None:
    layer = SimpleNamespace(
        id=7,
        name="Cut 01",
        in_point=0.5,
        out_point=2.25,
        start_time=-1.0,
        source=SimpleNamespace(id=20, name="clip.mov"),
        comment="large metadata",
        parent=None,
    )

    assert inspect_aep.layer_data(layer, brief=True) == {
        "name": "Cut 01",
        "inPoint": 0.5,
        "outPoint": 2.25,
        "source": "clip.mov",
    }


def test_brief_layer_data_handles_layers_without_sources() -> None:
    layer = SimpleNamespace(name="Shape", in_point=0.0, out_point=3.0, source=None)

    assert inspect_aep.layer_data(layer, brief=True)["source"] is None

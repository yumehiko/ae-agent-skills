from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "skills/aftereffects-py-aep/scripts/inspect_aep.py"
sys.path.insert(0, str(SCRIPT.parent))
SPEC = importlib.util.spec_from_file_location("inspect_aep", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
inspect_aep = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(inspect_aep)


class FakeProperty:
    def __init__(self, value: object) -> None:
        self.value = value

    def value_at_time(self, time: float) -> object:
        del time
        return self.value


def fake_transform() -> dict[str, FakeProperty]:
    return {
        "ADBE Position": FakeProperty([100.0, 200.0, 0.0]),
        "ADBE Scale": FakeProperty([100.0, 100.0, 100.0]),
        "ADBE Opacity": FakeProperty(100.0),
    }


def test_brief_layer_data_keeps_only_requested_fields() -> None:
    layer = SimpleNamespace(
        id=7,
        name="Cut 01",
        in_point=0.5,
        out_point=2.25,
        start_time=-1.0,
        stretch=100.0,
        source=SimpleNamespace(id=20, name="clip.mov"),
        comment="large metadata",
        parent=None,
        transform=fake_transform(),
    )

    assert inspect_aep.layer_data(layer, brief=True) == {
        "name": "Cut 01",
        "inPoint": 0.5,
        "outPoint": 2.25,
        "startTime": -1.0,
        "stretch": 100.0,
        "sourceIn": 1.5,
        "sourceOut": 3.25,
        "source": "clip.mov",
        "transform": {
            "position": [100.0, 200.0, 0.0],
            "scale": [100.0, 100.0, 100.0],
            "opacity": 100.0,
        },
    }


def test_brief_layer_data_handles_layers_without_sources() -> None:
    layer = SimpleNamespace(
        name="Shape",
        in_point=0.0,
        out_point=3.0,
        start_time=0.0,
        stretch=100.0,
        source=None,
        transform=fake_transform(),
    )

    assert inspect_aep.layer_data(layer, brief=True)["source"] is None

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType


ROOT = Path(__file__).resolve().parents[1]


def load_gen_telop() -> ModuleType:
    path = ROOT / "examples" / "gen_telop.py"
    spec = importlib.util.spec_from_file_location("gen_telop", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_gen_telop_builds_v012_scene_features() -> None:
    module = load_gen_telop()
    scene = module.build_scene(module.TELOPS[0], 1, "ArialMT")
    layer = scene["layers"][0]

    assert layer["textStyleRanges"][0]["style"]["fillColor"] == [255, 210, 48]
    assert layer["textAnimators"][0]["properties"] == {
        "position": [0, 72],
        "scale": [88, 88],
        "opacity": 0,
        "rotation": -4,
    }
    assert layer["textAnimators"][0]["selector"]["animations"][0]["property"] == "start"
    assert scene["layout"][0]["type"] == "visual-center"

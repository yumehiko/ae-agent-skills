from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path

import py_aep
import pytest


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "skills/aftereffects-py-aep/scripts"
sys.path.insert(0, str(SCRIPTS))
SPEC = importlib.util.spec_from_file_location("editorial", SCRIPTS / "editorial.py")
assert SPEC is not None and SPEC.loader is not None
editorial = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = editorial
SPEC.loader.exec_module(editorial)
PROXY_SPEC = importlib.util.spec_from_file_location(
    "render_editorial_proxy", SCRIPTS / "render_editorial_proxy.py"
)
assert PROXY_SPEC is not None and PROXY_SPEC.loader is not None
proxy_helpers = importlib.util.module_from_spec(PROXY_SPEC)
PROXY_SPEC.loader.exec_module(proxy_helpers)


def make_video(path: Path) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        pytest.skip("ffmpeg is not installed")
    subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc2=size=200x100:rate=10:duration=2",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(path),
        ],
        check=True,
    )


def make_project(tmp_path: Path) -> tuple[Path, object]:
    media = tmp_path / "source.mov"
    make_video(media)
    app = py_aep.new(version="26.3x87")
    project = app.project
    footage = project.import_file(py_aep.ImportOptions(media))
    comp = project.root_folder.add_comp("CutsRaw", 100, 50, 1.0, 2.0, 10.0)
    layer = comp.add(footage)
    layer.name = "C01"
    layer.in_point = 0.0
    layer.out_point = 2.0
    source = tmp_path / "input.aep"
    project.save(source)
    return source, comp


def test_edl_export_apply_and_reparse(tmp_path: Path) -> None:
    source, _ = make_project(tmp_path)
    app = py_aep.parse(source)
    comp = editorial.find_comp(app.project, comp_name="CutsRaw", comp_id=None)
    document = editorial.export_edl(app, source, comp, sample_time=0.0)
    row = document["layers"][0]
    assert row["unsupported"] == []
    assert row["sourceWidth"] == 200
    assert row["sourceHeight"] == 100

    row["recordOutFrame"] = 15
    row["recordOut"] = 1.5
    row["position"] = [60.0, 25.0, 0.0]
    target_app = py_aep.parse(source)
    edited_comp = editorial.apply_edl(target_app.project, document)
    output = tmp_path / "edited.aep"
    target_app.project.save(output)

    checked = py_aep.parse(output).project
    checked_comp = editorial.find_comp(
        checked, comp_name=edited_comp.name, comp_id=edited_comp.id
    )
    checked_layer = checked_comp.layers[0]
    assert checked_layer.frame_out_point == 15
    assert checked_layer.transform["ADBE Position"].value == [60.0, 25.0, 0.0]


def test_edl_rejects_parented_layer(tmp_path: Path) -> None:
    source, _ = make_project(tmp_path)
    app = py_aep.parse(source)
    comp = editorial.find_comp(app.project, comp_name="CutsRaw", comp_id=None)
    parent = comp.add_null(2.0)
    comp.layers[1].parent = parent
    document = editorial.export_edl(app, source, comp, sample_time=0.0)
    assert "parent" in document["layers"][1]["unsupported"]
    with pytest.raises(ValueError, match="not safe"):
        editorial.validate_edl(document)


def test_visible_source_rect_uses_anchor_position_and_scale() -> None:
    row = {
        "anchor": [100.0, 50.0, 0.0],
        "position": [50.0, 25.0, 0.0],
        "scale": [100.0, 100.0, 100.0],
    }
    comp = {"width": 100, "height": 50}
    assert editorial.visible_source_rect(row, comp) == (50.0, 25.0, 100.0, 50.0)


def test_proxy_timing_uses_authoritative_frame_fields() -> None:
    row = {
        "recordInFrame": 0,
        "recordOutFrame": 15,
        "recordIn": 0.0,
        "recordOut": 2.0,
        "sourceIn": 0.25,
        "stretch": 100.0,
    }
    assert proxy_helpers.record_duration(row, 10.0) == 1.5
    assert proxy_helpers.source_time(row, 0.5, 10.0) == 1.0


def test_editorial_proxy_renders_manifest_sheets_and_video(tmp_path: Path) -> None:
    source, _ = make_project(tmp_path)
    app = py_aep.parse(source)
    comp = editorial.find_comp(app.project, comp_name="CutsRaw", comp_id=None)
    document = editorial.export_edl(app, source, comp, sample_time=0.0)
    edl = tmp_path / "cuts.json"
    edl.write_text(json.dumps(document), encoding="utf-8")
    output = tmp_path / "proxy"

    subprocess.run(
        [
            sys.executable,
            str(SCRIPTS / "render_editorial_proxy.py"),
            str(edl),
            "--output",
            str(output),
        ],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    manifest = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["validation"] == "offline-editorial-proxy"
    assert Path(manifest["proxy"]).is_file()
    assert Path(manifest["layers"][0]["contactSheet"]).is_file()
    assert len(manifest["layers"][0]["samples"]) == 5

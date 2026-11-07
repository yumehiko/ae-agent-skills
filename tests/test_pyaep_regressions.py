from __future__ import annotations

from pathlib import Path

import py_aep


def test_solid_footage_name_persists_after_save_and_reparse(
    tmp_path: Path,
) -> None:
    output = tmp_path / "solid-rename.aep"
    app = py_aep.new(version="26.3x87")
    comp = app.project.root_folder.add_comp(
        "Main",
        200,
        200,
        1.0,
        1.0,
        25.0,
    )
    layer = comp.add_solid(
        [1.0, 0.0, 0.0],
        "Original Solid",
        40,
        40,
        1.0,
        1.0,
    )
    footage = layer.source
    footage_id = footage.id

    footage.name = "Renamed Solid Item"
    app.project.save(output)

    checked = py_aep.parse(output).project
    solid = next(item for item in checked.footages if item.id == footage_id)
    assert solid.name == "Renamed Solid Item"


def test_animated_property_uses_containing_comp_timebase(tmp_path: Path) -> None:
    # 0.15.1 applied an animated template with a 24fps property timebase,
    # even when the containing comp used a different rate. Parser time
    # round-trip alone concealed it; AE interpreted those ticks differently.
    for fps in (25.0, 30000 / 1001):
        project = py_aep.new(version="26.3x87").project
        comp = project.root_folder.add_comp("Timebase", 100, 100, 1, 5, fps)
        layer = comp.add_shape()
        for match_name, value in [("ADBE Opacity", 50), ("ADBE Position", [20, 30, 0]), ("ADBE Scale", [70, 80, 100])]:
            layer.transform.property(match_name).set_value_at_time(15 / fps, value)
        output = tmp_path / f"timebase-{fps}.aep"
        project.save(output)
        checked = py_aep.parse(output).project.compositions[0]
        for match_name in ("ADBE Opacity", "ADBE Position", "ADBE Scale"):
            prop = checked.layers[0].transform.property(match_name)
            # Internal inspection is intentional regression evidence only;
            # production code must not patch these private binary fields.
            assert prop._tdb4._time_base == checked._cdta.internal_timebase

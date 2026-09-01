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

#!/usr/bin/env python3
"""Create non-proprietary fixtures for CompItem.duplicate parent validation."""

from __future__ import annotations

import argparse
from pathlib import Path

import py_aep


def build(path: Path) -> tuple[int, int]:
    app = py_aep.new(version="26.3x87")
    project = app.project
    comp = project.root_folder.add_comp(
        "DuplicateParentSource", 200, 200, 1.0, 1.0, 10.0
    )
    comp.add_solid([0.0, 0.0, 0.0], "Background", 200, 200, 1.0, 1.0)
    controller = comp.add_null(1.0)
    controller.name = "CTRL"
    child = comp.add_solid([1.0, 0.0, 0.0], "Child", 40, 40, 1.0, 1.0)
    child.name = "Child"
    child.transform["ADBE Position"].value = [140.0, 100.0, 0.0]
    child.parent = controller
    duplicate = comp.duplicate()
    duplicate.name = "DuplicateParentCopy"
    duplicate_child = next(layer for layer in duplicate.layers if layer.name == "Child")
    duplicate_parent = duplicate_child.parent
    assert duplicate_parent is not None
    project.save(path)
    return duplicate_child.id, duplicate_parent.id


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    output = args.output_dir.expanduser().resolve()
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite: {output}")
    output.mkdir(parents=True)

    keep = output / "duplicate-parent-keep-original.aep"
    child_id, parent_id = build(keep)

    app = py_aep.parse(keep)
    project = app.project
    original = next(
        comp for comp in project.compositions if comp.name == "DuplicateParentSource"
    )
    original.remove()
    removed = output / "duplicate-parent-remove-original.aep"
    project.save(removed)

    checked = py_aep.parse(removed).project
    duplicate = next(
        comp for comp in checked.compositions if comp.name == "DuplicateParentCopy"
    )
    child = next(layer for layer in duplicate.layers if layer.name == "Child")
    assert child.id == child_id
    assert child.parent is not None and child.parent.id == parent_id
    print(keep)
    print(removed)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

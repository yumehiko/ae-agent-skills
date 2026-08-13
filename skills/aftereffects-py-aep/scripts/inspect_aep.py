#!/usr/bin/env python3
"""Print a compact AEP inventory without dumping property trees."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import py_aep


def layer_data(layer: Any, *, brief: bool = False) -> dict[str, Any]:
    source = getattr(layer, "source", None)
    if brief:
        return {
            "name": layer.name,
            "inPoint": layer.in_point,
            "outPoint": layer.out_point,
            "source": source.name if source is not None else None,
        }
    result: dict[str, Any] = {
        "id": layer.id,
        "name": layer.name,
        "type": type(layer).__name__,
        "comment": layer.comment or None,
        "parent": layer.parent.name if layer.parent is not None else None,
        "timing": [layer.start_time, layer.in_point, layer.out_point],
    }
    if source is not None:
        result["source"] = {"id": source.id, "name": source.name}
    if type(layer).__name__ == "TextLayer":
        document = layer.text.source_text.value
        result["text"] = {
            "value": document.text,
            "font": document.font,
            "fontSize": document.font_size,
        }
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("project", type=Path)
    parser.add_argument("--comp")
    parser.add_argument(
        "--brief",
        action="store_true",
        help="Show only each layer's name, in/out points, and source name",
    )
    args = parser.parse_args()

    app = py_aep.parse(args.project.resolve())
    comps = app.project.compositions
    if args.comp is not None:
        comps = [comp for comp in comps if comp.name == args.comp]
        if len(comps) != 1:
            raise SystemExit(f"Expected one comp named {args.comp!r}, found {len(comps)}")

    value = {
        "path": str(args.project.resolve()),
        "aeVersion": app.version,
        "compositions": [
            {
                "id": comp.id,
                "name": comp.name,
                "size": [comp.width, comp.height],
                "duration": comp.duration,
                "frameRate": comp.frame_rate,
                "layers": [layer_data(layer, brief=args.brief) for layer in comp.layers],
            }
            for comp in comps
        ],
    }
    print(json.dumps(value, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Print a compact AEP inventory without dumping property trees."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import py_aep

from editorial import find_comp, property_value


def layer_data(
    layer: Any, *, brief: bool = False, sample_time: float = 0.0
) -> dict[str, Any]:
    source = getattr(layer, "source", None)
    if brief:
        stretch = float(layer.stretch)
        factor = stretch / 100.0 if stretch else 1.0
        return {
            "name": layer.name,
            "inPoint": layer.in_point,
            "outPoint": layer.out_point,
            "startTime": layer.start_time,
            "stretch": stretch,
            "sourceIn": (layer.in_point - layer.start_time) / factor,
            "sourceOut": (layer.out_point - layer.start_time) / factor,
            "source": source.name if source is not None else None,
            "transform": {
                "position": property_value(layer, "position", sample_time),
                "scale": property_value(layer, "scale", sample_time),
                "opacity": property_value(layer, "opacity", sample_time),
            },
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
    selectors = parser.add_mutually_exclusive_group()
    selectors.add_argument("--comp")
    selectors.add_argument("--comp-id", type=int)
    parser.add_argument(
        "--brief",
        action="store_true",
        help="Show compact timing, source, and transform data for layers",
    )
    parser.add_argument("--full", action="store_true", help="Show detailed layer data")
    parser.add_argument("--time", type=float, default=0.0)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.brief and args.full:
        parser.error("--brief and --full are mutually exclusive")

    project_path = args.project.expanduser().resolve()
    app = py_aep.parse(project_path)
    comps = app.project.compositions
    if args.comp is not None or args.comp_id is not None:
        comps = [
            find_comp(
                app.project,
                comp_name=args.comp,
                comp_id=args.comp_id,
            )
        ]

    include_layers = args.brief or args.full

    value = {
        "path": str(project_path),
        "aeVersion": app.version,
        "compositions": [
            {
                "id": comp.id,
                "name": comp.name,
                "size": [comp.width, comp.height],
                "duration": comp.duration,
                "frameRate": comp.frame_rate,
                "layerCount": len(comp.layers),
                **(
                    {
                        "layers": [
                            layer_data(
                                layer,
                                brief=args.brief,
                                sample_time=args.time,
                            )
                            for layer in comp.layers
                        ]
                    }
                    if include_layers
                    else {}
                ),
            }
            for comp in comps
        ],
    }
    rendered = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    if args.output is None:
        print(rendered, end="")
    else:
        output = args.output.expanduser().resolve()
        if output.exists():
            raise FileExistsError(f"Refusing to overwrite: {output}")
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered, encoding="utf-8")
        print(
            json.dumps(
                {
                    "output": str(output),
                    "compositions": len(comps),
                    "layersIncluded": include_layers,
                },
                ensure_ascii=False,
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

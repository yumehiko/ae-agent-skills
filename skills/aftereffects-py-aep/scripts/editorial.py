"""Strict EDL helpers for simple file-backed After Effects cut layers."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any


TRANSFORM_MATCH_NAMES = {
    "anchor": "ADBE Anchor Point",
    "position": "ADBE Position",
    "scale": "ADBE Scale",
    "rotation": "ADBE Rotate Z",
    "opacity": "ADBE Opacity",
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def find_comp(project: Any, *, comp_name: str | None, comp_id: int | None) -> Any:
    matches = [
        comp
        for comp in project.compositions
        if (comp_name is None or comp.name == comp_name)
        and (comp_id is None or comp.id == comp_id)
    ]
    if len(matches) != 1:
        selector = f"name={comp_name!r}, id={comp_id!r}"
        raise ValueError(f"Expected one composition for {selector}, found {len(matches)}")
    return matches[0]


def property_value(layer: Any, key: str, time: float) -> Any:
    prop = layer.transform[TRANSFORM_MATCH_NAMES[key]]
    return prop.value_at_time(time)


def source_path(layer: Any) -> str | None:
    source = getattr(layer, "source", None)
    main_source = getattr(source, "main_source", None)
    value = getattr(main_source, "file", None)
    return str(Path(value).expanduser().resolve()) if value else None


def unsupported_features(layer: Any) -> list[str]:
    reasons: list[str] = []
    if source_path(layer) is None:
        reasons.append("not-file-backed")
    if getattr(layer, "parent", None) is not None:
        reasons.append("parent")
    if getattr(layer, "effects", None) is not None:
        reasons.append("effects")
    if getattr(layer, "masks", None) is not None:
        reasons.append("masks")
    if bool(getattr(layer, "has_track_matte", False)):
        reasons.append("track-matte")
    if bool(getattr(layer, "is_track_matte", False)):
        reasons.append("matte-source")
    if bool(getattr(layer, "time_remap_enabled", False)):
        reasons.append("time-remap")
    if bool(getattr(layer, "three_d_layer", False)):
        reasons.append("3d")
    for key, match_name in TRANSFORM_MATCH_NAMES.items():
        prop = layer.transform[match_name]
        if getattr(prop, "keyframes", None):
            reasons.append(f"animated-{key}")
        if getattr(prop, "expression_enabled", False):
            reasons.append(f"expression-{key}")
    rotation = property_value(layer, "rotation", layer.in_point)
    if rotation not in (0, 0.0):
        reasons.append("rotation")
    stretch = float(layer.stretch)
    if stretch <= 0:
        reasons.append("non-positive-stretch")
    return reasons


def layer_to_edl(layer: Any, *, sample_time: float) -> dict[str, Any]:
    stretch = float(layer.stretch)
    factor = stretch / 100.0 if stretch else 1.0
    source = getattr(layer, "source", None)
    return {
        "layerId": layer.id,
        "index": layer.index,
        "name": layer.name,
        "sourceId": getattr(source, "id", None),
        "sourceName": getattr(source, "name", None),
        "sourcePath": source_path(layer),
        "sourceWidth": getattr(source, "width", None),
        "sourceHeight": getattr(source, "height", None),
        "recordInFrame": layer.frame_in_point,
        "recordOutFrame": layer.frame_out_point,
        "recordIn": layer.in_point,
        "recordOut": layer.out_point,
        "startTime": layer.start_time,
        "sourceIn": (layer.in_point - layer.start_time) / factor,
        "sourceOut": (layer.out_point - layer.start_time) / factor,
        "stretch": stretch,
        "anchor": property_value(layer, "anchor", sample_time),
        "position": property_value(layer, "position", sample_time),
        "scale": property_value(layer, "scale", sample_time),
        "rotation": property_value(layer, "rotation", sample_time),
        "opacity": property_value(layer, "opacity", sample_time),
        "unsupported": unsupported_features(layer),
    }


def export_edl(app: Any, project_path: Path, comp: Any, *, sample_time: float) -> dict[str, Any]:
    return {
        "schema": "ae-agent-edl/v1",
        "project": {
            "path": str(project_path),
            "sha256": sha256_file(project_path),
            "aeVersion": app.version,
        },
        "comp": {
            "id": comp.id,
            "name": comp.name,
            "width": comp.width,
            "height": comp.height,
            "frameRate": comp.frame_rate,
            "duration": comp.duration,
        },
        "sampleTime": sample_time,
        "removeUnlisted": False,
        "layers": [layer_to_edl(layer, sample_time=sample_time) for layer in comp.layers],
    }


def validate_edl(document: dict[str, Any]) -> None:
    if document.get("schema") != "ae-agent-edl/v1":
        raise ValueError("Unsupported EDL schema")
    for key in ("project", "comp", "layers"):
        if key not in document:
            raise ValueError(f"EDL is missing {key!r}")
    seen: set[int] = set()
    for row in document["layers"]:
        layer_id = int(row["layerId"])
        if layer_id in seen:
            raise ValueError(f"Duplicate layerId in EDL: {layer_id}")
        seen.add(layer_id)
        if row.get("unsupported"):
            raise ValueError(
                f"Layer {row.get('name', layer_id)!r} is not safe for EDL apply: "
                + ", ".join(row["unsupported"])
            )
        if float(row["stretch"]) <= 0:
            raise ValueError("EDL apply supports positive stretch only")
        if int(row["recordOutFrame"]) <= int(row["recordInFrame"]):
            raise ValueError("recordOutFrame must be greater than recordInFrame")


def apply_edl(project: Any, document: dict[str, Any]) -> Any:
    validate_edl(document)
    comp_info = document["comp"]
    comp = find_comp(
        project,
        comp_name=comp_info.get("name"),
        comp_id=int(comp_info["id"]),
    )
    expected_rate = float(comp_info["frameRate"])
    if abs(comp.frame_rate - expected_rate) > 1e-9:
        raise ValueError("Composition frame rate no longer matches the EDL")

    by_id = {layer.id: layer for layer in comp.layers}
    retained: set[int] = set()
    for row in document["layers"]:
        layer_id = int(row["layerId"])
        if layer_id not in by_id:
            raise ValueError(f"Layer id {layer_id} no longer exists")
        layer = by_id[layer_id]
        if unsupported_features(layer):
            raise ValueError(
                f"Layer {layer.name!r} is no longer a simple editorial layer"
            )
        if getattr(getattr(layer, "source", None), "id", None) != row.get("sourceId"):
            raise ValueError(f"Layer {layer.name!r} source changed since export")

        stretch = float(row["stretch"])
        record_in = int(row["recordInFrame"]) / comp.frame_rate
        record_out = int(row["recordOutFrame"]) / comp.frame_rate
        source_in = float(row["sourceIn"])
        layer.stretch = stretch
        layer.start_time = record_in - source_in * (stretch / 100.0)
        layer.in_point = record_in
        layer.out_point = record_out
        layer.name = str(row["name"])
        layer.transform["ADBE Position"].value = list(row["position"])
        layer.transform["ADBE Scale"].value = list(row["scale"])
        layer.transform["ADBE Opacity"].value = float(row["opacity"])
        retained.add(layer_id)

    if document.get("removeUnlisted"):
        for layer in list(comp.layers):
            if layer.id not in retained:
                if unsupported_features(layer):
                    raise ValueError(
                        f"Refusing to remove non-editorial layer {layer.name!r}"
                    )
                layer.remove()
    return comp


def visible_source_rect(
    row: dict[str, Any],
    comp: dict[str, Any],
    *,
    viewport_width: int | None = None,
    viewport_height: int | None = None,
) -> tuple[float, float, float, float]:
    comp_width = float(comp["width"])
    comp_height = float(comp["height"])
    view_width = float(viewport_width or comp_width)
    view_height = float(viewport_height or comp_height)
    if view_width > comp_width or view_height > comp_height:
        raise ValueError("Viewport cannot be larger than the composition")
    x0 = (comp_width - view_width) / 2.0
    y0 = (comp_height - view_height) / 2.0
    anchor = row["anchor"]
    position = row["position"]
    scale = row["scale"]
    sx = float(scale[0]) / 100.0
    sy = float(scale[1]) / 100.0
    if sx <= 0 or sy <= 0:
        raise ValueError("Editorial proxy supports positive scale only")
    left = float(anchor[0]) + (x0 - float(position[0])) / sx
    top = float(anchor[1]) + (y0 - float(position[1])) / sy
    return left, top, view_width / sx, view_height / sy

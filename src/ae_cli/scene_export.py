from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

from .client import AEClient


_NUMBER_PATTERN = re.compile(r"^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$")

_TRANSFORM_PATHS: Dict[str, str] = {
    "anchorPoint": "ADBE Transform Group.ADBE Anchor Point",
    "position": "ADBE Transform Group.ADBE Position",
    "scale": "ADBE Transform Group.ADBE Scale",
    "rotation": "ADBE Transform Group.ADBE Rotate Z",
    "opacity": "ADBE Transform Group.ADBE Opacity",
}

_TEXT_DOCUMENT_PATH = "ADBE Text Properties.ADBE Text Document"

_SUPPORTED_LAYER_TYPES = {"text", "null", "solid", "shape"}


def _to_scene_layer_type(raw_type: Any, *, is_null_layer: bool = False) -> str | None:
    if is_null_layer:
        return "null"
    normalized = str(raw_type or "").strip().lower()
    if normalized in {"solid", "video"}:
        return "solid"
    if normalized == "text":
        return "text"
    if normalized == "shape":
        return "shape"
    if normalized == "null":
        return "null"
    return None


def _parse_scalar(value: str) -> Any:
    lowered = value.lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False
    if _NUMBER_PATTERN.match(value):
        number = float(value)
        if number.is_integer():
            return int(number)
        return number
    return value


def _parse_property_value(raw_value: Any) -> Any:
    if not isinstance(raw_value, str):
        return raw_value
    text = raw_value.strip()
    if not text:
        return None
    if "," not in text:
        return _parse_scalar(text)
    return [_parse_scalar(part.strip()) for part in text.split(",")]


def _find_active_or_target_comp(client: AEClient, comp_id: int | None, comp_name: str | None) -> Dict[str, Any]:
    if comp_id is not None or comp_name:
        client.set_active_comp(comp_id=comp_id, comp_name=comp_name)
    comps = client.list_comps()
    for comp in comps:
        if comp.get("isActive"):
            return comp
    if comp_id is not None or comp_name:
        raise ValueError("Could not resolve target composition.")
    raise ValueError("No active composition found.")


def _is_supported_keyframe_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, (int, float, bool, str)):
        return True
    if isinstance(value, list):
        return all(isinstance(item, (int, float, bool, str)) for item in value)
    return False


def _is_supported_effect_value(value: Any) -> bool:
    if isinstance(value, (int, float, bool, str)):
        return True
    if isinstance(value, list):
        return all(isinstance(item, (int, float, bool, str)) for item in value)
    return False


def _slugify_layer_name(name: str) -> str:
    lowered = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")
    return slug or "layer"


def _build_layer_id(layer: Dict[str, Any], used: set[str]) -> str:
    base = _slugify_layer_name(str(layer.get("name") or "layer"))
    candidate = base
    suffix = 1
    while candidate in used:
        suffix += 1
        candidate = f"{base}-{suffix}"
    used.add(candidate)
    return candidate


def _collect_layer_properties(client: AEClient, layer_id: int) -> List[Dict[str, Any]]:
    return client.get_properties(
        layer_id=layer_id,
        include_groups=[
            "ADBE Transform Group",
            "ADBE Text Properties",
            "ADBE Effect Parade",
            "ADBE Root Vectors Group",
        ],
        include_group_children=True,
    )


def _extract_transform(props: List[Dict[str, Any]]) -> Dict[str, Any]:
    by_path: Dict[str, Any] = {}
    for prop in props:
        path = str(prop.get("path") or "")
        by_path[path] = _parse_property_value(prop.get("value"))
    transform: Dict[str, Any] = {}
    for scene_key, property_path in _TRANSFORM_PATHS.items():
        value = by_path.get(property_path)
        if value is None:
            continue
        transform[scene_key] = value
    return transform


def _extract_text(props: List[Dict[str, Any]]) -> str | None:
    for prop in props:
        path = str(prop.get("path") or "")
        if path != _TEXT_DOCUMENT_PATH:
            continue
        raw = str(prop.get("value") or "").strip()
        if not raw:
            return None
        if raw.startswith("[object") or raw.startswith("TextDocument"):
            return None
        return raw
    return None


def _collect_expression_paths(props: List[Dict[str, Any]]) -> List[str]:
    paths: List[str] = []
    for prop in props:
        if prop.get("hasExpression") is True and prop.get("path"):
            paths.append(str(prop["path"]))
    return paths


def export_scene(
    client: AEClient,
    *,
    comp_id: int | None = None,
    comp_name: str | None = None,
) -> Tuple[Dict[str, Any], List[str]]:
    warnings: List[str] = [
        "Only layer types text/null/solid/shape are exported in v0.3.",
    ]
    comp = _find_active_or_target_comp(client, comp_id=comp_id, comp_name=comp_name)
    layers = client.get_layers()

    scene_layers: List[Dict[str, Any]] = []
    used_ids: set[str] = set()

    layer_index_to_scene_id: Dict[int, str] = {}
    layer_index_to_parent_index: Dict[int, int | None] = {}

    for layer in layers:
        source_type = layer.get("type")
        scene_type = _to_scene_layer_type(source_type, is_null_layer=bool(layer.get("nullLayer")))
        if scene_type not in _SUPPORTED_LAYER_TYPES:
            warnings.append(
                f"Skipped unsupported layer '{layer.get('name')}' (id={layer.get('id')} type={source_type})."
            )
            continue

        layer_id = int(layer.get("id"))
        props = _collect_layer_properties(client, layer_id)
        scene_id = _build_layer_id(layer, used_ids)
        layer_index_to_scene_id[layer_id] = scene_id
        parent_index = layer.get("parentLayerId")
        layer_index_to_parent_index[layer_id] = int(parent_index) if isinstance(parent_index, int) else None

        scene_layer: Dict[str, Any] = {
            "id": scene_id,
            "type": scene_type,
            "name": layer.get("name"),
        }

        timing: Dict[str, Any] = {}
        for key in ("inPoint", "outPoint", "startTime"):
            value = layer.get(key)
            if isinstance(value, (int, float)):
                timing[key] = value
        if timing:
            scene_layer["timing"] = timing

        transform = _extract_transform(props)
        if transform:
            scene_layer["transform"] = transform

        if scene_type == "text":
            text = _extract_text(props)
            if text is None:
                warnings.append(
                    f"Text layer '{layer.get('name')}' source text could not be recovered; omitted text field."
                )
            else:
                scene_layer["text"] = text

        try:
            expressions = client.get_expressions(layer_id=layer_id)
            if expressions:
                scene_layer["expressions"] = [
                    {
                        "propertyPath": expression["propertyPath"],
                        "expression": expression["expression"],
                    }
                    for expression in expressions
                    if expression.get("propertyPath") and isinstance(expression.get("expression"), str)
                ]
        except Exception as exc:  # noqa: BLE001
            warnings.append(f"Failed to export expressions for layer '{layer.get('name')}': {exc}")

        try:
            animations = client.get_animations(layer_id=layer_id)
            animation_items: List[Dict[str, Any]] = []
            for animation in animations:
                property_path = animation.get("propertyPath")
                keyframes = animation.get("keyframes")
                if not property_path or not isinstance(keyframes, list) or len(keyframes) == 0:
                    continue
                normalized_keyframes: List[Dict[str, Any]] = []
                for keyframe in keyframes:
                    if "time" not in keyframe or "value" not in keyframe:
                        continue
                    if not _is_supported_keyframe_value(keyframe["value"]):
                        warnings.append(
                            f"Skipped unsupported keyframe value on layer '{layer.get('name')}' path '{property_path}'."
                        )
                        continue
                    normalized_keyframe: Dict[str, Any] = {
                        "time": keyframe["time"],
                        "value": keyframe["value"],
                    }
                    if keyframe.get("inInterp") in {"linear", "bezier", "hold"}:
                        normalized_keyframe["inInterp"] = keyframe["inInterp"]
                    if keyframe.get("outInterp") in {"linear", "bezier", "hold"}:
                        normalized_keyframe["outInterp"] = keyframe["outInterp"]
                    if keyframe.get("easeIn") is not None:
                        normalized_keyframe["easeIn"] = keyframe["easeIn"]
                    if keyframe.get("easeOut") is not None:
                        normalized_keyframe["easeOut"] = keyframe["easeOut"]
                    normalized_keyframes.append(normalized_keyframe)
                if normalized_keyframes:
                    animation_items.append(
                        {
                            "propertyPath": property_path,
                            "keyframes": normalized_keyframes,
                        }
                    )
            if animation_items:
                scene_layer["animations"] = animation_items
        except Exception as exc:  # noqa: BLE001
            warnings.append(f"Failed to export animations for layer '{layer.get('name')}': {exc}")

        expression_paths = _collect_expression_paths(props)
        if expression_paths and "expressions" not in scene_layer:
            warnings.append(f"Layer '{layer.get('name')}' has expressions, but export failed to resolve source text.")

        try:
            effects = client.get_effects(layer_id=layer_id)
            effect_items: List[Dict[str, Any]] = []
            for effect in effects:
                effect_match_name = effect.get("matchName")
                if not isinstance(effect_match_name, str) or len(effect_match_name) == 0:
                    continue
                effect_item: Dict[str, Any] = {"matchName": effect_match_name}
                effect_name = effect.get("name")
                if isinstance(effect_name, str) and len(effect_name) > 0:
                    effect_item["name"] = effect_name
                params: List[Dict[str, Any]] = []
                for param in effect.get("params", []):
                    property_index = param.get("propertyIndex")
                    value = param.get("value")
                    if not isinstance(property_index, int) or property_index <= 0:
                        continue
                    if not _is_supported_effect_value(value):
                        warnings.append(
                            f"Skipped unsupported effect value on layer '{layer.get('name')}'"
                            f" effect '{effect_name or effect_match_name}' param index {property_index}."
                        )
                        continue
                    params.append(
                        {
                            "propertyIndex": property_index,
                            "value": value,
                        }
                    )
                if params:
                    effect_item["params"] = params
                effect_items.append(effect_item)
            if effect_items:
                scene_layer["effects"] = effect_items
        except Exception as exc:  # noqa: BLE001
            warnings.append(f"Failed to export effects for layer '{layer.get('name')}': {exc}")

        if scene_type == "solid":
            if isinstance(layer.get("sourceWidth"), (int, float)):
                scene_layer["width"] = layer["sourceWidth"]
            if isinstance(layer.get("sourceHeight"), (int, float)):
                scene_layer["height"] = layer["sourceHeight"]
            if isinstance(layer.get("sourceDuration"), (int, float)):
                scene_layer["duration"] = layer["sourceDuration"]
            solid_color = layer.get("solidColor")
            if isinstance(solid_color, list) and len(solid_color) >= 3:
                scene_layer["color"] = [solid_color[0], solid_color[1], solid_color[2]]

        scene_layers.append(scene_layer)

    for scene_layer in scene_layers:
        layer_scene_id = scene_layer["id"]
        source_layer_index = None
        for index, mapped_scene_id in layer_index_to_scene_id.items():
            if mapped_scene_id == layer_scene_id:
                source_layer_index = index
                break
        if source_layer_index is None:
            continue
        parent_index = layer_index_to_parent_index.get(source_layer_index)
        if parent_index is None:
            continue
        parent_scene_id = layer_index_to_scene_id.get(parent_index)
        if parent_scene_id:
            scene_layer["parentId"] = parent_scene_id
        else:
            warnings.append(
                f"Layer '{scene_layer.get('name')}' parent was skipped because parent layer type is unsupported."
            )

    scene: Dict[str, Any] = {
        "composition": {
            "compId": comp.get("id"),
            "name": comp.get("name"),
            "width": comp.get("width"),
            "height": comp.get("height"),
            "duration": comp.get("duration"),
            "frameRate": comp.get("frameRate"),
            "pixelAspect": comp.get("pixelAspect"),
            "setActive": True,
        },
        "layers": scene_layers,
    }
    return scene, warnings

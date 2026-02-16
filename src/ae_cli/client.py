"""Thin HTTP client for the After Effects CEP bridge server."""

from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Any, Dict, List

import requests


class AEBridgeError(RuntimeError):
    """Raised when the CEP bridge returns an error payload."""

    def __init__(self, message: str, payload: Dict[str, Any] | None = None):
        super().__init__(message)
        self.payload = payload


def _compact_json(value: Any, max_len: int = 120) -> str:
    if isinstance(value, str):
        text = value
    else:
        text = json.dumps(value, ensure_ascii=False)
    if len(text) <= max_len:
        return text
    return f"{text[:max_len - 3]}..."


def _format_error_entry(entry: Any) -> str:
    if not isinstance(entry, dict):
        return _compact_json(entry)

    path = entry.get("path")
    if path in (None, ""):
        path = entry.get("instancePath")
    if path in (None, ""):
        path = entry.get("dataPath")

    message = entry.get("message") or entry.get("error")
    expected = entry.get("expected")
    actual = entry.get("actual")

    parts: List[str] = []
    if path not in (None, ""):
        parts.append(f"path={path}")
    if message:
        parts.append(str(message))
    if expected is not None:
        parts.append(f"expected={_compact_json(expected, max_len=80)}")
    if actual is not None:
        parts.append(f"actual={_compact_json(actual, max_len=80)}")

    if parts:
        return ", ".join(parts)
    return _compact_json(entry)


def _format_bridge_error_message(payload: Dict[str, Any]) -> str:
    message = str(payload.get("message", "Unknown error from After Effects bridge."))
    lines: List[str] = [message]

    errors = payload.get("errors")
    if isinstance(errors, list) and errors:
        lines.append("Validation errors:")
        max_items = 10
        for idx, entry in enumerate(errors[:max_items], start=1):
            lines.append(f"  {idx}. {_format_error_entry(entry)}")
        if len(errors) > max_items:
            lines.append(f"  ... and {len(errors) - max_items} more")

    error_text = payload.get("error")
    if error_text:
        lines.append(f"Error: {error_text}")

    details = payload.get("details")
    if details:
        lines.append(f"Details: {_compact_json(details)}")

    return "\n".join(lines)


@dataclass
class AEClient:
    """Simple wrapper around the CEP HTTP API."""

    base_url: str = "http://127.0.0.1:8080"
    timeout: float = 10.0

    @staticmethod
    def _layer_selector_payload(layer_id: int | None = None, layer_name: str | None = None) -> Dict[str, Any]:
        has_id = layer_id is not None
        has_name = layer_name is not None and len(layer_name) > 0
        if has_id == has_name:
            raise ValueError("Provide exactly one of layer_id or layer_name.")
        payload: Dict[str, Any] = {}
        if has_id:
            payload["layerId"] = layer_id
        else:
            payload["layerName"] = layer_name
        return payload

    def _url(self, path: str) -> str:
        return f"{self.base_url.rstrip('/')}{path}"

    def _handle_response(self, response: requests.Response) -> Any:
        payload: Any = None
        try:
            payload = response.json()
        except ValueError:
            payload = None

        if isinstance(payload, dict) and payload.get("status") != "success":
            raise AEBridgeError(_format_bridge_error_message(payload), payload=payload)

        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            if isinstance(payload, dict):
                raise AEBridgeError(_format_bridge_error_message(payload), payload=payload) from exc
            raise

        if isinstance(payload, dict):
            return payload.get("data", payload)
        return payload

    def health(self) -> Dict[str, Any]:
        """Check bridge health endpoint."""
        response = requests.get(self._url("/health"), timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def get_layers(self) -> List[Dict[str, Any]]:
        """Return the list of layers in the active composition."""
        response = requests.get(self._url("/layers"), timeout=self.timeout)
        return self._handle_response(response)

    def list_comps(self) -> List[Dict[str, Any]]:
        """Return the list of compositions in the current project."""
        response = requests.get(self._url("/comps"), timeout=self.timeout)
        return self._handle_response(response)

    def create_comp(
        self,
        name: str,
        width: int,
        height: int,
        duration: float,
        frame_rate: float,
        pixel_aspect: float = 1.0,
    ) -> Dict[str, Any]:
        """Create a composition in the current project."""
        response = requests.post(
            self._url("/comps"),
            json={
                "name": name,
                "width": width,
                "height": height,
                "duration": duration,
                "frameRate": frame_rate,
                "pixelAspect": pixel_aspect,
            },
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def set_active_comp(self, comp_id: int | None = None, comp_name: str | None = None) -> Dict[str, Any]:
        """Set active composition by id or name."""
        payload: Dict[str, Any] = {}
        if comp_id is not None:
            payload["compId"] = comp_id
        if comp_name is not None:
            payload["compName"] = comp_name
        response = requests.post(
            self._url("/active-comp"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def get_selected_properties(self) -> List[Dict[str, Any]]:
        """Return the currently selected properties across layers."""
        response = requests.get(self._url("/selected-properties"), timeout=self.timeout)
        return self._handle_response(response)

    def get_expression_errors(self) -> Dict[str, Any]:
        """Return expression error diagnostics for the active composition."""
        response = requests.get(self._url("/expression-errors"), timeout=self.timeout)
        return self._handle_response(response)

    def get_expressions(
        self,
        layer_id: int | None = None,
        layer_name: str | None = None,
    ) -> List[Dict[str, Any]]:
        """Return expression source text bindings for a layer."""
        params: List[tuple[str, Any]] = []
        selector = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        if "layerId" in selector:
            params.append(("layerId", selector["layerId"]))
        else:
            params.append(("layerName", selector["layerName"]))
        response = requests.get(
            self._url("/expressions"),
            params=params,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def get_animations(
        self,
        layer_id: int | None = None,
        layer_name: str | None = None,
    ) -> List[Dict[str, Any]]:
        """Return animated properties and keyframes for a layer."""
        params: List[tuple[str, Any]] = []
        selector = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        if "layerId" in selector:
            params.append(("layerId", selector["layerId"]))
        else:
            params.append(("layerName", selector["layerName"]))
        response = requests.get(
            self._url("/animations"),
            params=params,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def get_properties(
        self,
        layer_id: int | None = None,
        layer_name: str | None = None,
        include_groups: List[str] | None = None,
        exclude_groups: List[str] | None = None,
        max_depth: int | None = None,
        include_group_children: bool = False,
        time: float | None = None,
    ) -> List[Dict[str, Any]]:
        """Return the property tree for the specified layer."""
        params: List[tuple[str, Any]] = []
        selector = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        if "layerId" in selector:
            params.append(("layerId", selector["layerId"]))
        else:
            params.append(("layerName", selector["layerName"]))
        if include_groups:
            for group in include_groups:
                if group:
                    params.append(("includeGroup", group))
        if exclude_groups:
            for group in exclude_groups:
                if group:
                    params.append(("excludeGroup", group))
        if max_depth is not None:
            params.append(("maxDepth", max_depth))
        if include_group_children:
            params.append(("includeGroupChildren", "true"))
        if time is not None:
            params.append(("time", time))

        response = requests.get(
            self._url("/properties"),
            params=params,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def set_expression(
        self,
        property_path: str,
        expression: str,
        layer_id: int | None = None,
        layer_name: str | None = None,
    ) -> Dict[str, Any]:
        """Apply an expression to the given property."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload["propertyPath"] = property_path
        payload["expression"] = expression
        response = requests.post(
            self._url("/expression"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def set_property_value(
        self,
        property_path: str,
        value: Any,
        layer_id: int | None = None,
        layer_name: str | None = None,
    ) -> Dict[str, Any]:
        """Set a property value on the given property path."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload["propertyPath"] = property_path
        payload["value"] = value
        response = requests.post(
            self._url("/property-value"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def set_keyframe(
        self,
        property_path: str,
        time: float,
        value: Any,
        layer_id: int | None = None,
        layer_name: str | None = None,
        in_interp: str | None = None,
        out_interp: str | None = None,
        ease_in: Any | None = None,
        ease_out: Any | None = None,
    ) -> Dict[str, Any]:
        """Set a keyframe value at a specific time."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload["propertyPath"] = property_path
        payload["time"] = time
        payload["value"] = value
        if in_interp is not None:
            payload["inInterp"] = in_interp
        if out_interp is not None:
            payload["outInterp"] = out_interp
        if ease_in is not None:
            payload["easeIn"] = ease_in
        if ease_out is not None:
            payload["easeOut"] = ease_out

        response = requests.post(
            self._url("/keyframes"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def add_essential_property(
        self,
        property_path: str,
        layer_id: int | None = None,
        layer_name: str | None = None,
        essential_name: str | None = None,
    ) -> Dict[str, Any]:
        """Add a layer property to Essential Graphics in the active comp."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload["propertyPath"] = property_path
        if essential_name is not None:
            payload["essentialName"] = essential_name
        response = requests.post(
            self._url("/essential-property"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def add_effect(
        self,
        effect_match_name: str,
        layer_id: int | None = None,
        layer_name: str | None = None,
        effect_name: str | None = None,
    ) -> Dict[str, Any]:
        """Add an effect to the specified layer."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload["effectMatchName"] = effect_match_name
        if effect_name:
            payload["effectName"] = effect_name

        response = requests.post(
            self._url("/effects"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def get_effects(
        self,
        layer_id: int | None = None,
        layer_name: str | None = None,
    ) -> List[Dict[str, Any]]:
        """Return effects and parameter values for a layer."""
        params: List[tuple[str, Any]] = []
        selector = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        if "layerId" in selector:
            params.append(("layerId", selector["layerId"]))
        else:
            params.append(("layerName", selector["layerName"]))
        response = requests.get(
            self._url("/effects"),
            params=params,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def get_repeaters(
        self,
        layer_id: int | None = None,
        layer_name: str | None = None,
    ) -> List[Dict[str, Any]]:
        """Return shape repeater operators for a layer."""
        params: List[tuple[str, Any]] = []
        selector = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        if "layerId" in selector:
            params.append(("layerId", selector["layerId"]))
        else:
            params.append(("layerName", selector["layerName"]))
        response = requests.get(
            self._url("/repeaters"),
            params=params,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def add_shape_repeater(
        self,
        layer_id: int | None = None,
        layer_name: str | None = None,
        group_index: int = 1,
        name: str | None = None,
        copies: float | None = None,
        offset: float | None = None,
        position: List[float] | None = None,
        scale: List[float] | None = None,
        rotation: float | None = None,
        start_opacity: float | None = None,
        end_opacity: float | None = None,
    ) -> Dict[str, Any]:
        """Add a shape repeater operator to the specified shape group."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload["groupIndex"] = group_index
        if name is not None:
            payload["name"] = name
        if copies is not None:
            payload["copies"] = copies
        if offset is not None:
            payload["offset"] = offset
        if position is not None:
            payload["position"] = position
        if scale is not None:
            payload["scale"] = scale
        if rotation is not None:
            payload["rotation"] = rotation
        if start_opacity is not None:
            payload["startOpacity"] = start_opacity
        if end_opacity is not None:
            payload["endOpacity"] = end_opacity

        response = requests.post(
            self._url("/shape-repeater"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def add_layer(
        self,
        layer_type: str,
        name: str | None = None,
        text: str | None = None,
        width: int | None = None,
        height: int | None = None,
        color: List[float] | None = None,
        duration: float | None = None,
        shape_type: str | None = None,
        shape_size: List[float] | None = None,
        shape_position: List[float] | None = None,
        shape_fill_color: List[float] | None = None,
        shape_fill_opacity: float | None = None,
        shape_stroke_color: List[float] | None = None,
        shape_stroke_opacity: float | None = None,
        shape_stroke_width: float | None = None,
        shape_stroke_line_cap: str | None = None,
        shape_roundness: float | None = None,
    ) -> Dict[str, Any]:
        """Add a new layer to the active composition."""
        payload: Dict[str, Any] = {"layerType": layer_type}
        if name is not None:
            payload["name"] = name
        if text is not None:
            payload["text"] = text
        if width is not None:
            payload["width"] = width
        if height is not None:
            payload["height"] = height
        if color is not None:
            payload["color"] = color
        if duration is not None:
            payload["duration"] = duration
        if shape_type is not None:
            payload["shapeType"] = shape_type
        if shape_size is not None:
            payload["shapeSize"] = shape_size
        if shape_position is not None:
            payload["shapePosition"] = shape_position
        if shape_fill_color is not None:
            payload["shapeFillColor"] = shape_fill_color
        if shape_fill_opacity is not None:
            payload["shapeFillOpacity"] = shape_fill_opacity
        if shape_stroke_color is not None:
            payload["shapeStrokeColor"] = shape_stroke_color
        if shape_stroke_opacity is not None:
            payload["shapeStrokeOpacity"] = shape_stroke_opacity
        if shape_stroke_width is not None:
            payload["shapeStrokeWidth"] = shape_stroke_width
        if shape_stroke_line_cap is not None:
            payload["shapeStrokeLineCap"] = shape_stroke_line_cap
        if shape_roundness is not None:
            payload["shapeRoundness"] = shape_roundness

        response = requests.post(
            self._url("/layers"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def set_in_out_point(
        self,
        layer_id: int | None = None,
        layer_name: str | None = None,
        in_point: float | None = None,
        out_point: float | None = None,
    ) -> Dict[str, Any]:
        """Set in/out points for the specified layer."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        if in_point is not None:
            payload["inPoint"] = in_point
        if out_point is not None:
            payload["outPoint"] = out_point

        response = requests.post(
            self._url("/layer-in-out"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def move_layer_time(
        self,
        delta: float,
        layer_id: int | None = None,
        layer_name: str | None = None,
    ) -> Dict[str, Any]:
        """Move layer timing by delta seconds."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload["delta"] = delta
        response = requests.post(
            self._url("/layer-time"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def set_cti(self, time: float) -> Dict[str, Any]:
        """Set composition current time indicator."""
        response = requests.post(
            self._url("/cti"),
            json={"time": time},
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def set_work_area(self, start: float, duration: float) -> Dict[str, Any]:
        """Set composition work area start and duration."""
        response = requests.post(
            self._url("/work-area"),
            json={
                "start": start,
                "duration": duration,
            },
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def parent_layer(self, child_layer_id: int, parent_layer_id: int | None = None) -> Dict[str, Any]:
        """Set or clear parent relationship for a layer."""
        payload: Dict[str, Any] = {"childLayerId": child_layer_id}
        if parent_layer_id is not None:
            payload["parentLayerId"] = parent_layer_id
        response = requests.post(
            self._url("/layer-parent"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def precompose(
        self,
        layer_ids: List[int],
        name: str,
        move_all_attributes: bool = False,
    ) -> Dict[str, Any]:
        """Precompose selected layers."""
        response = requests.post(
            self._url("/precompose"),
            json={
                "layerIds": layer_ids,
                "name": name,
                "moveAllAttributes": move_all_attributes,
            },
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def duplicate_layer(self, layer_id: int) -> Dict[str, Any]:
        """Duplicate a layer."""
        response = requests.post(
            self._url("/duplicate-layer"),
            json={"layerId": layer_id},
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def move_layer_order(
        self,
        layer_id: int,
        before_layer_id: int | None = None,
        after_layer_id: int | None = None,
        to_top: bool = False,
        to_bottom: bool = False,
    ) -> Dict[str, Any]:
        """Move layer order relative to another layer or to top/bottom."""
        payload: Dict[str, Any] = {"layerId": layer_id}
        if before_layer_id is not None:
            payload["beforeLayerId"] = before_layer_id
        if after_layer_id is not None:
            payload["afterLayerId"] = after_layer_id
        if to_top:
            payload["toTop"] = True
        if to_bottom:
            payload["toBottom"] = True

        response = requests.post(
            self._url("/layer-order"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def delete_layer(self, layer_id: int) -> Dict[str, Any]:
        """Delete a layer in the active composition."""
        response = requests.post(
            self._url("/delete-layer"),
            json={"layerId": layer_id},
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def delete_comp(self, comp_id: int | None = None, comp_name: str | None = None) -> Dict[str, Any]:
        """Delete a composition by id or name."""
        payload: Dict[str, Any] = {}
        if comp_id is not None:
            payload["compId"] = comp_id
        if comp_name is not None:
            payload["compName"] = comp_name

        response = requests.post(
            self._url("/delete-comp"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def apply_scene(
        self,
        scene: Dict[str, Any],
        validate_only: bool = False,
        mode: str = "merge",
    ) -> Dict[str, Any]:
        """Apply a declarative scene JSON payload."""
        response = requests.post(
            self._url("/scene"),
            json={
                "scene": scene,
                "validateOnly": validate_only,
                "mode": mode,
            },
            timeout=self.timeout,
        )
        return self._handle_response(response)

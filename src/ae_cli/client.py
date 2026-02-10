"""Thin HTTP client for the After Effects CEP bridge server."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

import requests


class AEBridgeError(RuntimeError):
    """Raised when the CEP bridge returns an error payload."""


@dataclass
class AEClient:
    """Simple wrapper around the CEP HTTP API."""

    base_url: str = "http://127.0.0.1:8080"
    timeout: float = 10.0

    def _url(self, path: str) -> str:
        return f"{self.base_url.rstrip('/')}{path}"

    def _handle_response(self, response: requests.Response) -> Any:
        response.raise_for_status()
        payload = response.json()
        if payload.get("status") != "success":
            message = payload.get("message", "Unknown error from After Effects bridge.")
            raise AEBridgeError(message)
        return payload.get("data", payload)

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

    def get_properties(
        self,
        layer_id: int,
        include_groups: List[str] | None = None,
        exclude_groups: List[str] | None = None,
        max_depth: int | None = None,
    ) -> List[Dict[str, Any]]:
        """Return the property tree for the specified layer."""
        params: List[tuple[str, Any]] = [("layerId", layer_id)]
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

        response = requests.get(
            self._url("/properties"),
            params=params,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def set_expression(self, layer_id: int, property_path: str, expression: str) -> Dict[str, Any]:
        """Apply an expression to the given property."""
        response = requests.post(
            self._url("/expression"),
            json={
                "layerId": layer_id,
                "propertyPath": property_path,
                "expression": expression,
            },
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def set_property_value(self, layer_id: int, property_path: str, value: Any) -> Dict[str, Any]:
        """Set a property value on the given property path."""
        response = requests.post(
            self._url("/property-value"),
            json={
                "layerId": layer_id,
                "propertyPath": property_path,
                "value": value,
            },
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def set_keyframe(
        self,
        layer_id: int,
        property_path: str,
        time: float,
        value: Any,
        in_interp: str | None = None,
        out_interp: str | None = None,
        ease_in: Any | None = None,
        ease_out: Any | None = None,
    ) -> Dict[str, Any]:
        """Set a keyframe value at a specific time."""
        payload: Dict[str, Any] = {
            "layerId": layer_id,
            "propertyPath": property_path,
            "time": time,
            "value": value,
        }
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

    def add_effect(
        self,
        layer_id: int,
        effect_match_name: str,
        effect_name: str | None = None,
    ) -> Dict[str, Any]:
        """Add an effect to the specified layer."""
        payload: Dict[str, Any] = {
            "layerId": layer_id,
            "effectMatchName": effect_match_name,
        }
        if effect_name:
            payload["effectName"] = effect_name

        response = requests.post(
            self._url("/effects"),
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

        response = requests.post(
            self._url("/layers"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

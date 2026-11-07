"""Thin HTTP client for the After Effects CEP bridge server."""

from __future__ import annotations

from dataclasses import dataclass
import json
import os
from pathlib import Path
from typing import Any, Callable, Dict, List

import requests


class AEBridgeError(RuntimeError):
    """Raised when the CEP bridge returns an error payload."""

    def __init__(self, message: str, payload: Dict[str, Any] | None = None):
        super().__init__(message)
        self.payload = payload


def _validate_bridge_token(token: str, source: str) -> str:
    token = token.strip()
    try:
        token_bytes = bytes.fromhex(token)
    except ValueError as exc:
        raise AEBridgeError(f"Invalid bridge token in {source}.") from exc
    if len(token_bytes) != 32:
        raise AEBridgeError(f"Invalid bridge token in {source}.")
    return token


def load_bridge_token() -> str:
    """Load the per-session bridge token from the environment or user workspace."""
    env_token = os.environ.get("AE_BRIDGE_TOKEN")
    if env_token:
        return _validate_bridge_token(env_token, "AE_BRIDGE_TOKEN")

    configured_path = os.environ.get("AE_BRIDGE_TOKEN_FILE")
    token_path = (
        Path(configured_path).expanduser()
        if configured_path
        else Path.home() / "ae-agent-skills" / ".bridge-token"
    )
    try:
        token = token_path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise AEBridgeError(
            f"Bridge token not found at {token_path}. "
            "Open the ae-agent-skill panel in After Effects and try again."
        ) from exc
    return _validate_bridge_token(token, str(token_path))


class _AuthenticatedRequests:
    def __init__(self, token_loader: Callable[[], str]):
        self._token_loader = token_loader
        self._session: requests.Session | None = None

    def _get_session(self) -> requests.Session:
        if self._session is None:
            session = requests.Session()
            session.headers.update({"X-AE-Bridge-Token": self._token_loader()})
            self._session = session
        return self._session

    def get(self, *args: Any, **kwargs: Any) -> requests.Response:
        return self._get_session().get(*args, **kwargs)

    def post(self, *args: Any, **kwargs: Any) -> requests.Response:
        return self._get_session().post(*args, **kwargs)


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

    rollback = payload.get("rollback")
    if isinstance(rollback, dict):
        if rollback.get("succeeded") is True:
            lines.append("Rollback: succeeded")
        elif rollback.get("attempted") is True:
            lines.append("Rollback: failed or could not be verified")
        else:
            lines.append("Rollback: not attempted")
        warning = rollback.get("warning")
        if warning:
            lines.append(f"Rollback warning: {warning}")
        rollback_error = rollback.get("error")
        if rollback_error:
            lines.append(f"Rollback error: {rollback_error}")

    return "\n".join(lines)


@dataclass
class AEClient:
    """Simple wrapper around the CEP HTTP API."""

    base_url: str = "http://127.0.0.1:8080"
    timeout: float = 10.0
    token: str | None = None
    token_loader: Callable[[], str] | None = None

    def __post_init__(self) -> None:
        self._requests = requests
        if self.token:
            session = requests.Session()
            session.headers.update({"X-AE-Bridge-Token": self.token})
            self._requests = session
        elif self.token_loader:
            self._requests = _AuthenticatedRequests(self.token_loader)

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

    @staticmethod
    def _optional_comp_selector_payload(
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        has_id = comp_id is not None
        has_name = comp_name is not None and len(comp_name) > 0
        if has_id and has_name:
            raise ValueError("Provide at most one of comp_id or comp_name.")
        if has_id:
            if comp_id <= 0:
                raise ValueError("comp_id must be a positive integer.")
            return {"compId": comp_id}
        if has_name:
            return {"compName": comp_name}
        return {}

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
        response = self._requests.get(self._url("/health"), timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def purge_all_caches(self) -> Dict[str, Any]:
        """Purge all After Effects memory and disk caches."""
        response = self._requests.post(self._url("/purge"), json={}, timeout=self.timeout)
        return self._handle_response(response)

    def get_layers(
        self,
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> List[Dict[str, Any]]:
        """Return layers from the selected or active composition."""
        params = self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name)
        response = self._requests.get(self._url("/layers"), params=params, timeout=self.timeout)
        return self._handle_response(response)

    def list_comps(self) -> List[Dict[str, Any]]:
        """Return the list of compositions in the current project."""
        response = self._requests.get(self._url("/comps"), timeout=self.timeout)
        return self._handle_response(response)

    def list_footage(self) -> List[Dict[str, Any]]:
        """Return file-based footage items in the current project."""
        response = self._requests.get(self._url("/footage"), timeout=self.timeout)
        return self._handle_response(response)

    def import_footage(self, path: str, name: str | None = None) -> Dict[str, Any]:
        """Import footage by path, reusing an existing project item when possible."""
        payload: Dict[str, Any] = {"path": path}
        if name is not None:
            payload["name"] = name
        response = self._requests.post(
            self._url("/footage"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def add_footage_layer(
        self,
        footage_id: int | None = None,
        footage_name: str | None = None,
        path: str | None = None,
        name: str | None = None,
        source_in: float | None = None,
        source_out: float | None = None,
        timeline_in: float | None = None,
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Add footage to the active comp and map a source range onto the timeline."""
        selector_count = sum(
            value is not None and (not isinstance(value, str) or len(value) > 0)
            for value in (footage_id, footage_name, path)
        )
        if selector_count != 1:
            raise ValueError("Provide exactly one of footage_id, footage_name, or path.")
        payload: Dict[str, Any] = self._optional_comp_selector_payload(
            comp_id=comp_id, comp_name=comp_name
        )
        if footage_id is not None:
            payload["footageId"] = footage_id
        if footage_name is not None:
            payload["footageName"] = footage_name
        if path is not None:
            payload["path"] = path
        if name is not None:
            payload["name"] = name
        if source_in is not None:
            payload["sourceIn"] = source_in
        if source_out is not None:
            payload["sourceOut"] = source_out
        if timeline_in is not None:
            payload["timelineIn"] = timeline_in
        response = self._requests.post(
            self._url("/footage-layer"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def add_comp_layer(
        self,
        comp_id: int | None = None,
        comp_name: str | None = None,
        name: str | None = None,
        start_time: float | None = None,
        in_point: float | None = None,
        out_point: float | None = None,
        target_comp_id: int | None = None,
        target_comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Add an existing project composition as a layer in the active comp."""
        has_id = comp_id is not None
        has_name = comp_name is not None and len(comp_name) > 0
        if has_id == has_name:
            raise ValueError("Provide exactly one of comp_id or comp_name.")
        payload: Dict[str, Any] = {}
        if has_id:
            payload["compId"] = comp_id
        else:
            payload["compName"] = comp_name
        if name is not None:
            payload["name"] = name
        if start_time is not None:
            payload["startTime"] = start_time
        if in_point is not None:
            payload["inPoint"] = in_point
        if out_point is not None:
            payload["outPoint"] = out_point
        target_selector = self._optional_comp_selector_payload(
            comp_id=target_comp_id, comp_name=target_comp_name
        )
        if "compId" in target_selector:
            payload["targetCompId"] = target_selector["compId"]
        if "compName" in target_selector:
            payload["targetCompName"] = target_selector["compName"]
        response = self._requests.post(
            self._url("/comp-layer"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def set_footage_cut(
        self,
        source_in: float,
        source_out: float,
        timeline_in: float,
        layer_id: int | None = None,
        layer_name: str | None = None,
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Set an existing footage layer's source range and timeline placement."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        payload["sourceIn"] = source_in
        payload["sourceOut"] = source_out
        payload["timelineIn"] = timeline_in
        response = self._requests.post(
            self._url("/footage-cut"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def get_layer_audio(
        self,
        layer_id: int | None = None,
        layer_name: str | None = None,
    ) -> Dict[str, Any]:
        """Return mute state, current levels, and Audio Levels keyframes for a layer."""
        params = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        response = self._requests.get(
            self._url("/layer-audio"),
            params=params,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def set_layer_audio(
        self,
        layer_id: int | None = None,
        layer_name: str | None = None,
        muted: bool | None = None,
        level_db: float | None = None,
        fade_in: float | None = None,
        fade_out: float | None = None,
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Set mute, stereo-linked dB level, and optional fades for a layer."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        if muted is not None:
            payload["muted"] = muted
        if level_db is not None:
            payload["levelDb"] = level_db
        if fade_in is not None:
            payload["fadeIn"] = fade_in
        if fade_out is not None:
            payload["fadeOut"] = fade_out
        if muted is None and level_db is None and fade_in is None and fade_out is None:
            raise ValueError("Provide at least one audio setting.")
        response = self._requests.post(
            self._url("/layer-audio"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def list_fonts(self, query: str | None = None, limit: int = 200) -> Dict[str, Any]:
        """List installed After Effects fonts with their PostScript names."""
        params: Dict[str, Any] = {"limit": limit}
        if query is not None:
            params["query"] = query
        response = self._requests.get(self._url("/fonts"), params=params, timeout=self.timeout)
        return self._handle_response(response)

    def get_text_style(
        self,
        layer_id: int | None = None,
        layer_name: str | None = None,
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Return the whole-layer text style for a text layer."""
        params = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        params.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        response = self._requests.get(self._url("/text-style"), params=params, timeout=self.timeout)
        return self._handle_response(response)

    def set_text_style(
        self,
        layer_id: int | None = None,
        layer_name: str | None = None,
        comp_id: int | None = None,
        comp_name: str | None = None,
        **style: Any,
    ) -> Dict[str, Any]:
        """Partially update the whole-layer text style for a text layer."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        declared_style = {key: value for key, value in style.items() if value is not None}
        payload.update(declared_style)
        if not declared_style:
            raise ValueError("Provide at least one text style setting.")
        response = self._requests.post(self._url("/text-style"), json=payload, timeout=self.timeout)
        return self._handle_response(response)

    def set_text_style_ranges(
        self,
        text_style_ranges: List[Dict[str, Any]],
        layer_id: int | None = None,
        layer_name: str | None = None,
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Apply half-open per-character style ranges (After Effects 24.3+)."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        payload["textStyleRanges"] = text_style_ranges
        response = self._requests.post(
            self._url("/text-style-ranges"), json=payload, timeout=self.timeout
        )
        return self._handle_response(response)

    def set_text_animators(
        self,
        text_animators: List[Dict[str, Any]],
        layer_id: int | None = None,
        layer_name: str | None = None,
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Replace ae-agent managed Range Selector text animators."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        payload["textAnimators"] = text_animators
        response = self._requests.post(
            self._url("/text-animators"), json=payload, timeout=self.timeout
        )
        return self._handle_response(response)

    @staticmethod
    def _layer_list_selector_payload(
        layer_ids: List[int] | None = None,
        layer_names: List[str] | None = None,
    ) -> Dict[str, Any]:
        has_ids = layer_ids is not None
        has_names = layer_names is not None
        if has_ids == has_names:
            raise ValueError("Provide exactly one of layer_ids or layer_names.")
        return {"layerIds": layer_ids} if has_ids else {"layerNames": layer_names}

    def align_layers(
        self,
        layer_ids: List[int] | None = None,
        layer_names: List[str] | None = None,
        horizontal: str | None = None,
        vertical: str | None = None,
        reference: str = "comp",
        offset: List[float] | None = None,
        margin_percent: float | None = None,
        time: float = 0.0,
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Align visual layer bounds to a composition reference rectangle."""
        payload = self._layer_list_selector_payload(layer_ids=layer_ids, layer_names=layer_names)
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        payload["reference"] = reference
        payload["time"] = time
        if horizontal is not None:
            payload["horizontal"] = horizontal
        if vertical is not None:
            payload["vertical"] = vertical
        if offset is not None:
            payload["offset"] = offset
        if margin_percent is not None:
            payload["marginPercent"] = margin_percent
        response = self._requests.post(self._url("/layout-align"), json=payload, timeout=self.timeout)
        return self._handle_response(response)

    def distribute_layers(
        self,
        axis: str,
        layer_ids: List[int] | None = None,
        layer_names: List[str] | None = None,
        mode: str = "gaps",
        reference: str = "comp",
        margin_percent: float | None = None,
        time: float = 0.0,
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Distribute visual layer bounds with equal gaps or center spacing."""
        payload = self._layer_list_selector_payload(layer_ids=layer_ids, layer_names=layer_names)
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        payload.update({"axis": axis, "mode": mode, "reference": reference, "time": time})
        if margin_percent is not None:
            payload["marginPercent"] = margin_percent
        response = self._requests.post(self._url("/layout-distribute"), json=payload, timeout=self.timeout)
        return self._handle_response(response)

    def visual_center_layers(
        self,
        layer_ids: List[int] | None = None,
        layer_names: List[str] | None = None,
        time: float = 0.0,
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Move anchor points to visual centers while preserving comp-space appearance."""
        payload = self._layer_list_selector_payload(layer_ids=layer_ids, layer_names=layer_names)
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        payload["time"] = time
        response = self._requests.post(
            self._url("/layout-visual-center"), json=payload, timeout=self.timeout
        )
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
        response = self._requests.post(
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
        response = self._requests.post(
            self._url("/active-comp"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def get_selected_properties(self) -> List[Dict[str, Any]]:
        """Return the currently selected properties across layers."""
        response = self._requests.get(self._url("/selected-properties"), timeout=self.timeout)
        return self._handle_response(response)

    def get_expression_errors(
        self,
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Return expression errors from the selected or active composition."""
        params = self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name)
        response = self._requests.get(
            self._url("/expression-errors"),
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
        property_path: str | None = None,
        max_depth: int | None = None,
        include_group_children: bool = False,
        include_keyframes: bool = False,
        include_expression: bool = False,
        include_disabled: bool = False,
        time: float | None = None,
        comp_id: int | None = None,
        comp_name: str | None = None,
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
        if property_path:
            params.append(("propertyPath", property_path))
        if max_depth is not None:
            params.append(("maxDepth", max_depth))
        if include_group_children:
            params.append(("includeGroupChildren", "true"))
        if include_keyframes:
            params.append(("includeKeyframes", "true"))
        if include_expression:
            params.append(("includeExpression", "true"))
        if include_disabled:
            params.append(("includeDisabled", "true"))
        if time is not None:
            params.append(("time", time))
        comp_selector = self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name)
        for key, value in comp_selector.items():
            params.append((key, value))

        response = self._requests.get(
            self._url("/properties"),
            params=params,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def get_layer_bounds(
        self,
        layer_id: int | None = None,
        layer_name: str | None = None,
        comp_id: int | None = None,
        comp_name: str | None = None,
        time: float = 0.0,
    ) -> Dict[str, Any]:
        """Return visual layer bounds in composition coordinates."""
        params = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        params.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        params["time"] = time
        response = self._requests.get(
            self._url("/layer-bounds"),
            params=params,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def create_snapshot(
        self,
        out_path: str,
        comp_id: int | None = None,
        comp_name: str | None = None,
        time: float = 0.0,
        scale: float = 1.0,
    ) -> Dict[str, Any]:
        """Render one composition frame to a new PNG file."""
        comp_selector = self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name)
        if not comp_selector:
            raise ValueError("Provide exactly one of comp_id or comp_name.")
        payload: Dict[str, Any] = {
            "outPath": out_path,
            "time": time,
            "scale": scale,
        }
        payload.update(comp_selector)
        response = self._requests.post(
            self._url("/snapshot"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def set_expression(
        self,
        property_path: str,
        expression: str,
        layer_id: int | None = None,
        layer_name: str | None = None,
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Apply an expression to the given property."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        payload["propertyPath"] = property_path
        payload["expression"] = expression
        response = self._requests.post(
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
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Set a property value on the given property path."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        payload["propertyPath"] = property_path
        payload["value"] = value
        response = self._requests.post(
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
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Set a keyframe value at a specific time."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
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

        response = self._requests.post(
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
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Add a layer property to Essential Graphics in the active comp."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        payload["propertyPath"] = property_path
        if essential_name is not None:
            payload["essentialName"] = essential_name
        response = self._requests.post(
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
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Add an effect to the specified layer."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        payload["effectMatchName"] = effect_match_name
        if effect_name:
            payload["effectName"] = effect_name

        response = self._requests.post(
            self._url("/effects"),
            json=payload,
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
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Add a shape repeater operator to the specified shape group."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
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

        response = self._requests.post(
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
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Add a new layer to the active composition."""
        payload: Dict[str, Any] = {"layerType": layer_type}
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
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

        response = self._requests.post(
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
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Set in/out points for the specified layer."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        if in_point is not None:
            payload["inPoint"] = in_point
        if out_point is not None:
            payload["outPoint"] = out_point

        response = self._requests.post(
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
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Move layer timing by delta seconds."""
        payload = self._layer_selector_payload(layer_id=layer_id, layer_name=layer_name)
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        payload["delta"] = delta
        response = self._requests.post(
            self._url("/layer-time"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def set_cti(
        self,
        time: float,
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Set composition current time indicator."""
        payload: Dict[str, Any] = {"time": time}
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        response = self._requests.post(
            self._url("/cti"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def set_work_area(
        self,
        start: float,
        duration: float,
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Set composition work area start and duration."""
        payload: Dict[str, Any] = {"start": start, "duration": duration}
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        response = self._requests.post(
            self._url("/work-area"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def parent_layer(
        self,
        child_layer_id: int,
        parent_layer_id: int | None = None,
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Set or clear parent relationship for a layer."""
        payload: Dict[str, Any] = {"childLayerId": child_layer_id}
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        if parent_layer_id is not None:
            payload["parentLayerId"] = parent_layer_id
        response = self._requests.post(
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
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Precompose selected layers."""
        payload: Dict[str, Any] = {
            "layerIds": layer_ids,
            "name": name,
            "moveAllAttributes": move_all_attributes,
        }
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        response = self._requests.post(
            self._url("/precompose"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def duplicate_layer(
        self,
        layer_id: int,
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Duplicate a layer."""
        payload: Dict[str, Any] = {"layerId": layer_id}
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        response = self._requests.post(
            self._url("/duplicate-layer"),
            json=payload,
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
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Move layer order relative to another layer or to top/bottom."""
        payload: Dict[str, Any] = {"layerId": layer_id}
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        if before_layer_id is not None:
            payload["beforeLayerId"] = before_layer_id
        if after_layer_id is not None:
            payload["afterLayerId"] = after_layer_id
        if to_top:
            payload["toTop"] = True
        if to_bottom:
            payload["toBottom"] = True

        response = self._requests.post(
            self._url("/layer-order"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def delete_layer(
        self,
        layer_id: int,
        comp_id: int | None = None,
        comp_name: str | None = None,
    ) -> Dict[str, Any]:
        """Delete a layer in the active composition."""
        payload: Dict[str, Any] = {"layerId": layer_id}
        payload.update(self._optional_comp_selector_payload(comp_id=comp_id, comp_name=comp_name))
        response = self._requests.post(
            self._url("/delete-layer"),
            json=payload,
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

        response = self._requests.post(
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
        expect_project: str | None = None,
    ) -> Dict[str, Any]:
        """Apply a declarative scene JSON payload."""
        payload: Dict[str, Any] = {
            "scene": scene,
            "validateOnly": validate_only,
            "mode": mode,
        }
        if expect_project is not None:
            payload["expectProject"] = expect_project
        response = self._requests.post(
            self._url("/scene"),
            json=payload,
            timeout=self.timeout,
        )
        return self._handle_response(response)

from __future__ import annotations

from typing import Any

import requests

from ae_cli.client import AEBridgeError, AEClient


class DummyResponse:
    def __init__(self, payload: Any, should_raise: bool = False):
        self._payload = payload
        self._should_raise = should_raise

    def raise_for_status(self) -> None:
        if self._should_raise:
            raise requests.HTTPError("boom")

    def json(self) -> Any:
        return self._payload


def test_handle_response_returns_data_payload() -> None:
    client = AEClient()
    response = DummyResponse({"status": "success", "data": [{"id": 1}]})
    assert client._handle_response(response) == [{"id": 1}]


def test_handle_response_raises_for_bridge_error() -> None:
    client = AEClient()
    response = DummyResponse({"status": "error", "message": "bad request"})
    try:
        client._handle_response(response)
    except AEBridgeError as exc:
        assert "bad request" in str(exc)
    else:
        raise AssertionError("AEBridgeError was not raised")


def test_get_properties_builds_query_params(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_get(url: str, params: Any, timeout: float) -> DummyResponse:
        captured["url"] = url
        captured["params"] = params
        captured["timeout"] = timeout
        return DummyResponse({"status": "success", "data": []})

    monkeypatch.setattr(requests, "get", fake_get)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.get_properties(
        layer_id=7,
        include_groups=["A", ""],
        exclude_groups=["B"],
        max_depth=3,
    )

    assert captured["url"] == "http://127.0.0.1:8080/properties"
    assert captured["timeout"] == 5.0
    assert captured["params"] == [
        ("layerId", 7),
        ("includeGroup", "A"),
        ("excludeGroup", "B"),
        ("maxDepth", 3),
    ]


def test_create_comp_posts_expected_payload(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: Any, timeout: float) -> DummyResponse:
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return DummyResponse({"status": "success", "data": {"id": 10}})

    monkeypatch.setattr(requests, "post", fake_post)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.create_comp(
        name="Main",
        width=1920,
        height=1080,
        duration=8.0,
        frame_rate=30.0,
    )

    assert captured["url"] == "http://127.0.0.1:8080/comps"
    assert captured["timeout"] == 5.0
    assert captured["json"] == {
        "name": "Main",
        "width": 1920,
        "height": 1080,
        "duration": 8.0,
        "frameRate": 30.0,
        "pixelAspect": 1.0,
    }


def test_set_keyframe_posts_expected_payload(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: Any, timeout: float) -> DummyResponse:
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return DummyResponse({"status": "success", "data": {"keyIndex": 1}})

    monkeypatch.setattr(requests, "post", fake_post)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.set_keyframe(
        layer_id=1,
        property_path="ADBE Transform Group.ADBE Position",
        time=0.5,
        value=[960, 540],
    )

    assert captured["url"] == "http://127.0.0.1:8080/keyframes"
    assert captured["timeout"] == 5.0
    assert captured["json"] == {
        "layerId": 1,
        "propertyPath": "ADBE Transform Group.ADBE Position",
        "time": 0.5,
        "value": [960, 540],
    }


def test_set_keyframe_posts_easing_payload(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: Any, timeout: float) -> DummyResponse:
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return DummyResponse({"status": "success", "data": {"keyIndex": 2}})

    monkeypatch.setattr(requests, "post", fake_post)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.set_keyframe(
        layer_id=1,
        property_path="ADBE Transform Group.ADBE Position",
        time=1.0,
        value=[960, 300],
        in_interp="bezier",
        out_interp="bezier",
        ease_in=[0, 80],
        ease_out=[0, 40],
    )

    assert captured["url"] == "http://127.0.0.1:8080/keyframes"
    assert captured["timeout"] == 5.0
    assert captured["json"] == {
        "layerId": 1,
        "propertyPath": "ADBE Transform Group.ADBE Position",
        "time": 1.0,
        "value": [960, 300],
        "inInterp": "bezier",
        "outInterp": "bezier",
        "easeIn": [0, 80],
        "easeOut": [0, 40],
    }

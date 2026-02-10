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
        include_group_children=True,
        time=1.25,
    )

    assert captured["url"] == "http://127.0.0.1:8080/properties"
    assert captured["timeout"] == 5.0
    assert captured["params"] == [
        ("layerId", 7),
        ("includeGroup", "A"),
        ("excludeGroup", "B"),
        ("maxDepth", 3),
        ("includeGroupChildren", "true"),
        ("time", 1.25),
    ]


def test_get_properties_supports_layer_name(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_get(url: str, params: Any, timeout: float) -> DummyResponse:
        captured["params"] = params
        return DummyResponse({"status": "success", "data": []})

    monkeypatch.setattr(requests, "get", fake_get)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.get_properties(layer_name="Control")
    assert captured["params"] == [("layerName", "Control")]


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


def test_add_layer_posts_shape_payload(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: Any, timeout: float) -> DummyResponse:
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return DummyResponse({"status": "success", "data": {"layerId": 2}})

    monkeypatch.setattr(requests, "post", fake_post)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.add_layer(
        layer_type="shape",
        name="Burst",
        shape_type="ellipse",
        shape_size=[640, 640],
        shape_position=[0, 0],
        shape_fill_color=[255, 128, 0],
        shape_fill_opacity=90,
        shape_stroke_color=[255, 255, 255],
        shape_stroke_opacity=100,
        shape_stroke_width=6,
        shape_stroke_line_cap="round",
    )

    assert captured["url"] == "http://127.0.0.1:8080/layers"
    assert captured["timeout"] == 5.0
    assert captured["json"] == {
        "layerType": "shape",
        "name": "Burst",
        "shapeType": "ellipse",
        "shapeSize": [640, 640],
        "shapePosition": [0, 0],
        "shapeFillColor": [255, 128, 0],
        "shapeFillOpacity": 90,
        "shapeStrokeColor": [255, 255, 255],
        "shapeStrokeOpacity": 100,
        "shapeStrokeWidth": 6,
        "shapeStrokeLineCap": "round",
    }


def test_add_shape_repeater_posts_expected_payload(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: Any, timeout: float) -> DummyResponse:
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return DummyResponse({"status": "success", "data": {"repeaterName": "BurstRepeater"}})

    monkeypatch.setattr(requests, "post", fake_post)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.add_shape_repeater(
        layer_id=3,
        group_index=1,
        name="BurstRepeater",
        copies=12,
        offset=0.5,
        position=[0, -30],
        scale=[100, 100],
        rotation=20,
        start_opacity=100,
        end_opacity=0,
    )

    assert captured["url"] == "http://127.0.0.1:8080/shape-repeater"
    assert captured["timeout"] == 5.0
    assert captured["json"] == {
        "layerId": 3,
        "groupIndex": 1,
        "name": "BurstRepeater",
        "copies": 12,
        "offset": 0.5,
        "position": [0, -30],
        "scale": [100, 100],
        "rotation": 20,
        "startOpacity": 100,
        "endOpacity": 0,
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


def test_set_in_out_point_posts_expected_payload(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: Any, timeout: float) -> DummyResponse:
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return DummyResponse({"status": "success", "data": {"layerId": 2}})

    monkeypatch.setattr(requests, "post", fake_post)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.set_in_out_point(layer_id=2, in_point=0.5, out_point=3.0)

    assert captured["url"] == "http://127.0.0.1:8080/layer-in-out"
    assert captured["timeout"] == 5.0
    assert captured["json"] == {
        "layerId": 2,
        "inPoint": 0.5,
        "outPoint": 3.0,
    }


def test_move_layer_time_posts_expected_payload(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: Any, timeout: float) -> DummyResponse:
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return DummyResponse({"status": "success", "data": {"layerId": 2}})

    monkeypatch.setattr(requests, "post", fake_post)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.move_layer_time(layer_id=2, delta=1.25)

    assert captured["url"] == "http://127.0.0.1:8080/layer-time"
    assert captured["timeout"] == 5.0
    assert captured["json"] == {
        "layerId": 2,
        "delta": 1.25,
    }


def test_move_layer_time_supports_layer_name(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: Any, timeout: float) -> DummyResponse:
        captured["json"] = json
        return DummyResponse({"status": "success", "data": {"layerId": 2}})

    monkeypatch.setattr(requests, "post", fake_post)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.move_layer_time(layer_name="Title", delta=0.5)

    assert captured["json"] == {
        "layerName": "Title",
        "delta": 0.5,
    }


def test_layer_selector_payload_raises_when_selector_is_invalid() -> None:
    client = AEClient()
    try:
        client._layer_selector_payload()
    except ValueError as exc:
        assert "exactly one" in str(exc)
    else:
        raise AssertionError("ValueError was not raised")


def test_set_cti_posts_expected_payload(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: Any, timeout: float) -> DummyResponse:
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return DummyResponse({"status": "success", "data": {"time": 2.0}})

    monkeypatch.setattr(requests, "post", fake_post)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.set_cti(time=2.0)

    assert captured["url"] == "http://127.0.0.1:8080/cti"
    assert captured["timeout"] == 5.0
    assert captured["json"] == {"time": 2.0}


def test_set_work_area_posts_expected_payload(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: Any, timeout: float) -> DummyResponse:
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return DummyResponse({"status": "success", "data": {"start": 1.0}})

    monkeypatch.setattr(requests, "post", fake_post)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.set_work_area(start=1.0, duration=4.0)

    assert captured["url"] == "http://127.0.0.1:8080/work-area"
    assert captured["timeout"] == 5.0
    assert captured["json"] == {
        "start": 1.0,
        "duration": 4.0,
    }


def test_parent_layer_posts_expected_payload(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: Any, timeout: float) -> DummyResponse:
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return DummyResponse({"status": "success", "data": {"childLayerId": 2}})

    monkeypatch.setattr(requests, "post", fake_post)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.parent_layer(child_layer_id=2, parent_layer_id=1)

    assert captured["url"] == "http://127.0.0.1:8080/layer-parent"
    assert captured["timeout"] == 5.0
    assert captured["json"] == {
        "childLayerId": 2,
        "parentLayerId": 1,
    }


def test_precompose_posts_expected_payload(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: Any, timeout: float) -> DummyResponse:
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return DummyResponse({"status": "success", "data": {"compName": "Precomp"}})

    monkeypatch.setattr(requests, "post", fake_post)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.precompose(layer_ids=[3, 2], name="Precomp", move_all_attributes=True)

    assert captured["url"] == "http://127.0.0.1:8080/precompose"
    assert captured["timeout"] == 5.0
    assert captured["json"] == {
        "layerIds": [3, 2],
        "name": "Precomp",
        "moveAllAttributes": True,
    }


def test_duplicate_layer_posts_expected_payload(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: Any, timeout: float) -> DummyResponse:
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return DummyResponse({"status": "success", "data": {"duplicatedLayerId": 6}})

    monkeypatch.setattr(requests, "post", fake_post)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.duplicate_layer(layer_id=4)

    assert captured["url"] == "http://127.0.0.1:8080/duplicate-layer"
    assert captured["timeout"] == 5.0
    assert captured["json"] == {"layerId": 4}


def test_move_layer_order_posts_expected_payload(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: Any, timeout: float) -> DummyResponse:
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return DummyResponse({"status": "success", "data": {"layerId": 4}})

    monkeypatch.setattr(requests, "post", fake_post)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.move_layer_order(layer_id=4, before_layer_id=2)

    assert captured["url"] == "http://127.0.0.1:8080/layer-order"
    assert captured["timeout"] == 5.0
    assert captured["json"] == {
        "layerId": 4,
        "beforeLayerId": 2,
    }


def test_delete_layer_posts_expected_payload(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: Any, timeout: float) -> DummyResponse:
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return DummyResponse({"status": "success", "data": {"layerId": 3}})

    monkeypatch.setattr(requests, "post", fake_post)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.delete_layer(layer_id=3)

    assert captured["url"] == "http://127.0.0.1:8080/delete-layer"
    assert captured["timeout"] == 5.0
    assert captured["json"] == {"layerId": 3}


def test_delete_comp_posts_expected_payload(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, json: Any, timeout: float) -> DummyResponse:
        captured["url"] = url
        captured["json"] = json
        captured["timeout"] = timeout
        return DummyResponse({"status": "success", "data": {"compId": 11}})

    monkeypatch.setattr(requests, "post", fake_post)

    client = AEClient(base_url="http://127.0.0.1:8080", timeout=5.0)
    client.delete_comp(comp_name="Main")

    assert captured["url"] == "http://127.0.0.1:8080/delete-comp"
    assert captured["timeout"] == 5.0
    assert captured["json"] == {"compName": "Main"}

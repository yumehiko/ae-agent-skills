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

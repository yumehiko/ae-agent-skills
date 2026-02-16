from __future__ import annotations

from typing import Any

from ae_cli.scene_export import export_scene


class FakeClient:
    def __init__(self) -> None:
        self._active_comp_name = "Main"

    def set_active_comp(self, comp_id: int | None = None, comp_name: str | None = None) -> dict[str, Any]:
        if comp_name:
            self._active_comp_name = comp_name
        if comp_id is not None:
            self._active_comp_name = "Main"
        return {"compName": self._active_comp_name}

    def list_comps(self) -> list[dict[str, Any]]:
        return [
            {
                "id": 10,
                "name": self._active_comp_name,
                "width": 1920,
                "height": 1080,
                "pixelAspect": 1.0,
                "duration": 8.0,
                "frameRate": 30.0,
                "isActive": True,
            }
        ]

    def get_layers(self) -> list[dict[str, Any]]:
        return [
            {
                "id": 1,
                "name": "Title",
                "type": "Text",
                "parentLayerId": None,
                "inPoint": 0.0,
                "outPoint": 8.0,
                "startTime": 0.0,
                "nullLayer": False,
            },
            {
                "id": 2,
                "name": "BG",
                "type": "Video",
                "parentLayerId": 1,
                "inPoint": 0.0,
                "outPoint": 8.0,
                "startTime": 0.0,
                "nullLayer": False,
                "sourceWidth": 1920,
                "sourceHeight": 1080,
                "sourceDuration": 8.0,
                "solidColor": [0.1, 0.2, 0.3],
            },
            {
                "id": 4,
                "name": "Burst",
                "type": "Shape",
                "parentLayerId": None,
                "inPoint": 0.0,
                "outPoint": 8.0,
                "startTime": 0.0,
                "nullLayer": False,
            },
            {"id": 3, "name": "Camera 1", "type": "Camera", "parentLayerId": None, "nullLayer": False},
        ]

    def get_properties(self, layer_id: int, **_kwargs: Any) -> list[dict[str, Any]]:
        if layer_id == 1:
            return [
                {
                    "name": "Position",
                    "path": "ADBE Transform Group.ADBE Position",
                    "value": "960, 540",
                    "hasExpression": False,
                },
                {
                    "name": "Opacity",
                    "path": "ADBE Transform Group.ADBE Opacity",
                    "value": "100",
                    "hasExpression": True,
                },
                {
                    "name": "Source Text",
                    "path": "ADBE Text Properties.ADBE Text Document",
                    "value": "Hello",
                    "hasExpression": False,
                },
            ]
        if layer_id == 2:
            return [
                {
                    "name": "Position",
                    "path": "ADBE Transform Group.ADBE Position",
                    "value": "960, 540",
                    "hasExpression": False,
                },
                {
                    "name": "Scale",
                    "path": "ADBE Transform Group.ADBE Scale",
                    "value": "100, 100, 100",
                    "hasExpression": False,
                },
                {
                    "name": "Casts Shadows",
                    "path": "ADBE Material Options Group.ADBE Casts Shadows",
                    "value": "true",
                    "typedValue": True,
                    "hasExpression": False,
                },
            ]
        return []

    def get_expressions(self, layer_id: int, **_kwargs: Any) -> list[dict[str, Any]]:
        if layer_id != 1:
            return []
        return [
            {
                "propertyPath": "ADBE Transform Group.ADBE Opacity",
                "expression": "wiggle(2,20)",
            }
        ]

    def get_animations(self, layer_id: int, **_kwargs: Any) -> list[dict[str, Any]]:
        if layer_id != 1:
            return []
        return [
            {
                "propertyPath": "ADBE Transform Group.ADBE Position",
                "keyframes": [
                    {"time": 0.0, "value": [960, 540], "inInterp": "linear", "outInterp": "bezier"},
                    {"time": 1.0, "value": [960, 300], "inInterp": "bezier", "outInterp": "bezier"},
                ],
            }
        ]

    def get_effects(self, layer_id: int, **_kwargs: Any) -> list[dict[str, Any]]:
        if layer_id != 1:
            return []
        return [
            {
                "matchName": "ADBE Slider Control",
                "name": "Slider Control",
                "params": [
                    {
                        "propertyIndex": 1,
                        "matchName": "ADBE Slider Control-0001",
                        "propertyPath": "ADBE Effect Parade.ADBE Slider Control.ADBE Slider Control-0001",
                        "value": 55,
                    }
                ],
            }
        ]

    def get_repeaters(self, layer_id: int, **_kwargs: Any) -> list[dict[str, Any]]:
        if layer_id != 4:
            return []
        return [
            {
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
        ]

    def get_essential_properties(self) -> dict[str, Any]:
        return {
            "count": 1,
            "controllers": [
                {"index": 1, "name": "Opacity"},
            ],
        }


def test_export_scene_builds_supported_layers_and_warnings() -> None:
    scene, warnings = export_scene(FakeClient())

    assert scene["composition"]["name"] == "Main"
    assert len(scene["layers"]) == 3
    assert scene["layers"][0]["type"] == "text"
    assert scene["layers"][0]["text"] == "Hello"
    assert scene["layers"][0]["timing"]["inPoint"] == 0.0
    assert scene["layers"][0]["expressions"][0]["expression"] == "wiggle(2,20)"
    assert scene["layers"][0]["animations"][0]["propertyPath"] == "ADBE Transform Group.ADBE Position"
    assert scene["layers"][0]["effects"][0]["matchName"] == "ADBE Slider Control"
    assert scene["layers"][0]["effects"][0]["params"][0]["propertyIndex"] == 1
    assert scene["layers"][0]["effects"][0]["params"][0]["value"] == 55
    assert scene["layers"][0]["essentialProperties"][0]["propertyPath"] == "ADBE Transform Group.ADBE Opacity"
    assert scene["layers"][0]["essentialProperties"][0]["essentialName"] == "Opacity"
    assert scene["layers"][0]["transform"]["position"] == [960, 540]
    assert scene["layers"][0]["transform"]["opacity"] == 100
    assert scene["layers"][1]["type"] == "solid"
    assert scene["layers"][1]["parentId"] == scene["layers"][0]["id"]
    assert scene["layers"][1]["width"] == 1920
    assert scene["layers"][1]["color"] == [0.1, 0.2, 0.3]
    assert scene["layers"][1]["transform"]["scale"] == [100, 100, 100]
    assert scene["layers"][1]["propertyValues"][0]["propertyPath"] == "ADBE Material Options Group.ADBE Casts Shadows"
    assert scene["layers"][1]["propertyValues"][0]["value"] is True
    assert scene["layers"][2]["type"] == "shape"
    assert scene["layers"][2]["repeaters"][0]["name"] == "BurstRepeater"
    assert scene["layers"][2]["repeaters"][0]["copies"] == 12
    assert any("Skipped unsupported layer 'Camera 1'" in warning for warning in warnings)

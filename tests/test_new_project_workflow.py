from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = (
    ROOT
    / "skills/aftereffects-py-aep/assets/new_project_template.py"
)
SPEC = importlib.util.spec_from_file_location("new_project_template", TEMPLATE)
assert SPEC is not None and SPEC.loader is not None
new_project = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = new_project
SPEC.loader.exec_module(new_project)


def test_new_project_template_builds_saves_and_reparses(tmp_path: Path) -> None:
    output = tmp_path / "from-scratch.aep"

    def build_scene(project: object, main_comp: object) -> None:
        del project
        solid = main_comp.add_solid(
            [0.05, 0.05, 0.05],
            "Background",
            1080,
            1920,
            1.0,
            5.0,
        )
        solid.name = "Background"
        shape = main_comp.add_shape()
        shape.name = "Accent"
        title = main_comp.add_text("Hello")
        title.name = "Title"

    def assert_scene(project: object, main_comp: object) -> None:
        del project
        assert [layer.name for layer in main_comp.layers] == [
            "Title",
            "Accent",
            "Background",
        ]
        assert main_comp.layers[0].text.source_text.value.text == "Hello"

    new_project.build_scene = build_scene
    new_project.assert_scene = assert_scene
    result = new_project.run(
        new_project.ProjectConfig(
            output=output,
            ae_version="26.3x87",
            comp_name="Main",
            width=1080,
            height=1920,
            pixel_aspect=1.0,
            duration=5.0,
            frame_rate=30.0,
        )
    )

    assert output.is_file()
    assert result == {
        "output": str(output.resolve()),
        "aeVersion": "26.3x87",
        "mainComp": "Main",
        "compositions": 1,
        "layers": 3,
    }


def test_new_project_template_refuses_existing_output(tmp_path: Path) -> None:
    output = tmp_path / "existing.aep"
    output.write_bytes(b"existing")
    config = new_project.ProjectConfig(
        output=output,
        ae_version="26.3x87",
        comp_name="Main",
        width=1920,
        height=1080,
        pixel_aspect=1.0,
        duration=1.0,
        frame_rate=30.0,
    )

    try:
        new_project.run(config)
    except FileExistsError as exc:
        assert "Refusing to overwrite" in str(exc)
    else:
        raise AssertionError("FileExistsError was not raised")

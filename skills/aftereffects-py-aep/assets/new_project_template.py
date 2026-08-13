#!/usr/bin/env python3
"""Copy into a job's _automation directory and implement the two marked hooks."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import py_aep


@dataclass(frozen=True)
class ProjectConfig:
    output: Path
    ae_version: str
    comp_name: str
    width: int
    height: int
    pixel_aspect: float
    duration: float
    frame_rate: float
    preferences_dir: Path | None = None


def build_scene(project: Any, main_comp: Any) -> None:
    """Build the task scene. Replace this function in the copied script."""
    raise NotImplementedError("Implement build_scene() for this project")


def assert_scene(project: Any, main_comp: Any) -> None:
    """Assert task semantics after reparse. Replace this function in the copied script."""
    raise NotImplementedError("Implement assert_scene() for this project")


def run(config: ProjectConfig) -> dict[str, Any]:
    output = config.output.expanduser().resolve()
    if output.suffix.lower() != ".aep":
        raise ValueError("Output must use the .aep extension")
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite: {output}")

    preferences = (
        str(config.preferences_dir.expanduser().resolve())
        if config.preferences_dir is not None
        else None
    )
    app = py_aep.new(version=config.ae_version, ae_preferences_dir=preferences)
    project = app.project
    main_comp = project.root_folder.add_comp(
        config.comp_name,
        config.width,
        config.height,
        config.pixel_aspect,
        config.duration,
        config.frame_rate,
    )
    build_scene(project, main_comp)
    project.save(output)

    checked_project = py_aep.parse(output).project
    matches = [comp for comp in checked_project.compositions if comp.name == config.comp_name]
    if len(matches) != 1:
        raise AssertionError(
            f"Expected one {config.comp_name!r} comp after reparse, found {len(matches)}"
        )
    checked_main = matches[0]
    assert checked_main.width == config.width
    assert checked_main.height == config.height
    assert checked_main.pixel_aspect == config.pixel_aspect
    assert checked_main.duration == config.duration
    assert checked_main.frame_rate == config.frame_rate
    assert_scene(checked_project, checked_main)

    return {
        "output": str(output),
        "aeVersion": app.version,
        "mainComp": checked_main.name,
        "compositions": len(checked_project.compositions),
        "layers": len(checked_main.layers),
    }


def parse_args() -> ProjectConfig:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--ae-version", required=True, help='For example "26.3x87"')
    parser.add_argument("--comp-name", default="Main")
    parser.add_argument("--width", type=int, required=True)
    parser.add_argument("--height", type=int, required=True)
    parser.add_argument("--pixel-aspect", type=float, default=1.0)
    parser.add_argument("--duration", type=float, required=True)
    parser.add_argument("--frame-rate", type=float, required=True)
    parser.add_argument("--preferences-dir", type=Path)
    args = parser.parse_args()
    return ProjectConfig(
        output=args.output,
        ae_version=args.ae_version,
        comp_name=args.comp_name,
        width=args.width,
        height=args.height,
        pixel_aspect=args.pixel_aspect,
        duration=args.duration,
        frame_rate=args.frame_rate,
        preferences_dir=args.preferences_dir,
    )


if __name__ == "__main__":
    print(json.dumps(run(parse_args()), ensure_ascii=False, indent=2))

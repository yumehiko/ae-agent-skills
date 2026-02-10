from __future__ import annotations

from types import SimpleNamespace

from ae_cli.cli_parser import build_parser
from ae_cli.cli_runner import run_command


def test_build_parser_parses_properties_filters() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "--base-url",
            "http://localhost:8080",
            "properties",
            "--layer-id",
            "3",
            "--include-group",
            "ADBE Transform Group",
            "--exclude-group",
            "ADBE Effect Parade",
            "--max-depth",
            "2",
        ]
    )
    assert args.command == "properties"
    assert args.layer_id == 3
    assert args.include_group == ["ADBE Transform Group"]
    assert args.exclude_group == ["ADBE Effect Parade"]
    assert args.max_depth == 2


def test_build_parser_parses_add_layer_color() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "add-layer",
            "--layer-type",
            "solid",
            "--color",
            "32",
            "64",
            "128",
        ]
    )
    assert args.command == "add-layer"
    assert args.color == [32.0, 64.0, 128.0]


def test_build_parser_parses_create_comp() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "create-comp",
            "--name",
            "Main",
            "--width",
            "1920",
            "--height",
            "1080",
            "--duration",
            "8",
            "--frame-rate",
            "30",
        ]
    )
    assert args.command == "create-comp"
    assert args.name == "Main"
    assert args.width == 1920
    assert args.height == 1080
    assert args.duration == 8.0
    assert args.frame_rate == 30.0
    assert args.pixel_aspect == 1.0


def test_build_parser_parses_set_keyframe_json_value() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "set-keyframe",
            "--layer-id",
            "1",
            "--property-path",
            "ADBE Transform Group.ADBE Position",
            "--time",
            "0.5",
            "--value",
            "[960,540]",
        ]
    )
    assert args.command == "set-keyframe"
    assert args.layer_id == 1
    assert args.property_path == "ADBE Transform Group.ADBE Position"
    assert args.time == 0.5
    assert args.value == "[960,540]"

def test_build_parser_parses_set_keyframe_easing_options() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "set-keyframe",
            "--layer-id",
            "1",
            "--property-path",
            "ADBE Transform Group.ADBE Position",
            "--time",
            "1.0",
            "--value",
            "[960,300]",
            "--in-interp",
            "bezier",
            "--out-interp",
            "bezier",
            "--ease-in",
            "[0,80]",
            "--ease-out",
            "[0,40]",
        ]
    )
    assert args.in_interp == "bezier"
    assert args.out_interp == "bezier"
    assert args.ease_in == "[0,80]"
    assert args.ease_out == "[0,40]"


def test_run_command_returns_2_for_unknown_command(capsys) -> None:
    args = SimpleNamespace(command="unknown", base_url="http://x", timeout=1.0)
    code = run_command(args)
    captured = capsys.readouterr()
    assert code == 2
    assert "Unknown command" in captured.err

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


def test_build_parser_parses_properties_layer_name_and_time_options() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "properties",
            "--layer-name",
            "Control",
            "--include-group",
            "ADBE Effect Parade",
            "--include-group-children",
            "--time",
            "1.25",
        ]
    )
    assert args.command == "properties"
    assert args.layer_id is None
    assert args.layer_name == "Control"
    assert args.include_group == ["ADBE Effect Parade"]
    assert args.include_group_children is True
    assert args.time == 1.25


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


def test_build_parser_parses_add_shape_layer_options() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "add-layer",
            "--layer-type",
            "shape",
            "--shape-type",
            "ellipse",
            "--shape-size",
            "640",
            "640",
            "--shape-position",
            "0",
            "0",
            "--shape-fill-color",
            "255",
            "128",
            "0",
            "--shape-fill-opacity",
            "90",
            "--shape-stroke-color",
            "255",
            "255",
            "255",
            "--shape-stroke-opacity",
            "100",
            "--shape-stroke-width",
            "6",
            "--shape-stroke-line-cap",
            "round",
        ]
    )
    assert args.command == "add-layer"
    assert args.layer_type == "shape"
    assert args.shape_type == "ellipse"
    assert args.shape_size == [640.0, 640.0]
    assert args.shape_position == [0.0, 0.0]
    assert args.shape_fill_color == [255.0, 128.0, 0.0]
    assert args.shape_fill_opacity == 90.0
    assert args.shape_stroke_color == [255.0, 255.0, 255.0]
    assert args.shape_stroke_opacity == 100.0
    assert args.shape_stroke_width == 6.0
    assert args.shape_stroke_line_cap == "round"


def test_build_parser_parses_add_shape_repeater() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "add-shape-repeater",
            "--layer-id",
            "3",
            "--group-index",
            "1",
            "--name",
            "BurstRepeater",
            "--copies",
            "12",
            "--offset",
            "0.5",
            "--position",
            "0",
            "-30",
            "--scale",
            "100",
            "100",
            "--rotation",
            "20",
            "--start-opacity",
            "100",
            "--end-opacity",
            "0",
        ]
    )
    assert args.command == "add-shape-repeater"
    assert args.layer_id == 3
    assert args.group_index == 1
    assert args.name == "BurstRepeater"
    assert args.copies == 12.0
    assert args.offset == 0.5
    assert args.position == [0.0, -30.0]
    assert args.scale == [100.0, 100.0]
    assert args.rotation == 20.0
    assert args.start_opacity == 100.0
    assert args.end_opacity == 0.0


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

def test_build_parser_parses_set_in_out_point() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "set-in-out-point",
            "--layer-id",
            "5",
            "--in-point",
            "1.2",
            "--out-point",
            "4.8",
        ]
    )
    assert args.command == "set-in-out-point"
    assert args.layer_id == 5
    assert args.in_point == 1.2
    assert args.out_point == 4.8


def test_build_parser_parses_move_layer_time_with_layer_name() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "move-layer-time",
            "--layer-name",
            "Title",
            "--delta",
            "0.25",
        ]
    )
    assert args.command == "move-layer-time"
    assert args.layer_id is None
    assert args.layer_name == "Title"
    assert args.delta == 0.25


def test_build_parser_parses_precompose_multi_layers() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "precompose",
            "--layer-id",
            "3",
            "--layer-id",
            "1",
            "--name",
            "Shot_A",
            "--move-all-attributes",
        ]
    )
    assert args.command == "precompose"
    assert args.layer_id == [3, 1]
    assert args.name == "Shot_A"
    assert args.move_all_attributes is True


def test_build_parser_parses_move_layer_order_to_top() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "move-layer-order",
            "--layer-id",
            "4",
            "--to-top",
        ]
    )
    assert args.command == "move-layer-order"
    assert args.layer_id == 4
    assert args.to_top is True


def test_build_parser_parses_delete_layer() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "delete-layer",
            "--layer-id",
            "7",
        ]
    )
    assert args.command == "delete-layer"
    assert args.layer_id == 7


def test_build_parser_parses_delete_comp_by_name() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "delete-comp",
            "--comp-name",
            "Main",
        ]
    )
    assert args.command == "delete-comp"
    assert args.comp_name == "Main"
    assert args.comp_id is None


def test_run_command_returns_2_for_unknown_command(capsys) -> None:
    args = SimpleNamespace(command="unknown", base_url="http://x", timeout=1.0)
    code = run_command(args)
    captured = capsys.readouterr()
    assert code == 2
    assert "Unknown command" in captured.err

from __future__ import annotations

from types import SimpleNamespace

from ae_cli.cli_parser import build_parser
from ae_cli.cli_runner import (
    _brief_layers,
    _filter_properties,
    _resolve_scene_asset_paths,
    run_command,
)


def test_brief_layers_keeps_only_identity_fields() -> None:
    layers = [
        {
            "id": 1,
            "layerUid": 101,
            "name": "Title",
            "type": "TextLayer",
            "isNull": False,
            "startTime": 0,
            "source": {"path": "/large/payload.mov"},
            "audio": {"enabled": True},
        }
    ]

    assert _brief_layers(layers) == [
        {
            "id": 1,
            "layerUid": 101,
            "name": "Title",
            "type": "TextLayer",
            "isNull": False,
        }
    ]


def test_brief_layers_preserves_missing_optional_identity_fields() -> None:
    assert _brief_layers([{"id": 1, "name": "Legacy"}]) == [
        {"id": 1, "name": "Legacy"}
    ]


def test_filter_properties_matches_name_or_path() -> None:
    properties = [
        {"name": "Opacity", "path": "Transform.Opacity"},
        {"name": "Amount", "path": "Effects.Drop Shadow.Amount"},
        {"name": "Position", "path": "Transform.Position"},
    ]

    assert _filter_properties(properties, r"Opacity|Drop Shadow") == properties[:2]


def test_filter_properties_rejects_invalid_regex() -> None:
    try:
        _filter_properties([], "[")
    except ValueError as exc:
        assert "Invalid --filter" in str(exc)
    else:
        raise AssertionError("ValueError was not raised")


def test_resolve_scene_asset_paths_supports_scene_relative_paths(tmp_path) -> None:
    scene_file = tmp_path / "_edl" / "main.scene.json"
    scene_file.parent.mkdir()
    scene = {"assets": [{"id": "clip", "path": "../media/clip.mov"}]}

    resolved = _resolve_scene_asset_paths(scene, scene_file)

    assert resolved["assets"][0]["path"] == str((tmp_path / "media/clip.mov").resolve())


def test_resolve_scene_asset_paths_expands_environment_variables(
    monkeypatch, tmp_path
) -> None:
    media_root = tmp_path / "shared-media"
    monkeypatch.setenv("MEDIA_ROOT", str(media_root))
    scene = {"assets": [{"id": "clip", "path": "${MEDIA_ROOT}/clip.mov"}]}

    resolved = _resolve_scene_asset_paths(scene, tmp_path / "main.scene.json")

    assert resolved["assets"][0]["path"] == str((media_root / "clip.mov").resolve())


def test_resolve_scene_asset_paths_rejects_missing_environment_variables(tmp_path) -> None:
    scene = {"assets": [{"id": "clip", "path": "${MISSING_MEDIA_ROOT}/clip.mov"}]}

    try:
        _resolve_scene_asset_paths(scene, tmp_path / "main.scene.json")
    except ValueError as exc:
        assert "MISSING_MEDIA_ROOT" in str(exc)
    else:
        raise AssertionError("ValueError was not raised")


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
            "--property-path",
            "ADBE Transform Group.ADBE Opacity",
            "--max-depth",
            "2",
            "--filter",
            "Opacity|Position",
            "--include-expression",
            "--include-disabled",
        ]
    )
    assert args.command == "properties"
    assert args.layer_id == 3
    assert args.include_group == ["ADBE Transform Group"]
    assert args.exclude_group == ["ADBE Effect Parade"]
    assert args.property_path == "ADBE Transform Group.ADBE Opacity"
    assert args.max_depth == 2
    assert args.property_filter == "Opacity|Position"
    assert args.include_expression is True
    assert args.include_disabled is True


def test_build_parser_parses_layers_brief() -> None:
    parser = build_parser()
    args = parser.parse_args(["layers", "--comp-name", "Main", "--brief"])

    assert args.command == "layers"
    assert args.comp_name == "Main"
    assert args.brief is True


def test_mutation_parsers_accept_explicit_comp_selectors() -> None:
    parser = build_parser()
    property_args = parser.parse_args([
        "set-property",
        "--layer-id", "2",
        "--comp-name", "Target",
        "--property-path", "ADBE Transform Group.ADBE Opacity",
        "--value", "80",
    ])
    cti_args = parser.parse_args(["set-cti", "--comp-id", "17", "--time", "1.25"])
    layer_args = parser.parse_args([
        "add-layer", "--comp-name", "Target", "--layer-type", "null",
    ])
    comp_layer_args = parser.parse_args([
        "add-comp-layer",
        "--comp-name", "Source",
        "--target-comp-name", "Target",
    ])

    assert property_args.comp_name == "Target"
    assert cti_args.comp_id == 17
    assert layer_args.comp_name == "Target"
    assert comp_layer_args.comp_name == "Source"
    assert comp_layer_args.target_comp_name == "Target"


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


def test_build_parser_parses_v012_text_and_visual_center_commands() -> None:
    parser = build_parser()
    ranges = parser.parse_args(
        ["set-text-style-ranges", "--layer-name", "Title", "--ranges-file", "ranges.json"]
    )
    animators = parser.parse_args(
        ["set-text-animators", "--layer-id", "2", "--animators-file", "animators.json"]
    )
    visual = parser.parse_args(
        ["visual-center", "--layer-name", "Title", "--time", "1.25"]
    )

    assert (ranges.command, ranges.ranges_file) == ("set-text-style-ranges", "ranges.json")
    assert (animators.command, animators.animators_file) == ("set-text-animators", "animators.json")
    assert visual.command == "visual-center"
    assert visual.layer_names == ["Title"]
    assert visual.time == 1.25


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


def test_build_parser_parses_import_footage() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "import-footage",
            "--path",
            "/clips/interview.mp4",
            "--name",
            "Interview",
        ]
    )
    assert args.command == "import-footage"
    assert args.path == "/clips/interview.mp4"
    assert args.name == "Interview"


def test_build_parser_parses_add_footage_layer_cut() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "add-footage-layer",
            "--footage-id",
            "12",
            "--name",
            "Clip 01",
            "--source-in",
            "12.5",
            "--source-out",
            "18",
            "--timeline-in",
            "3",
        ]
    )
    assert args.command == "add-footage-layer"
    assert args.footage_id == 12
    assert args.footage_name is None
    assert args.source_in == 12.5
    assert args.source_out == 18.0
    assert args.timeline_in == 3.0


def test_build_parser_parses_add_comp_layer() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "add-comp-layer",
            "--comp-name",
            "TX01_Title",
            "--name",
            "Title 01",
            "--start-time",
            "2",
            "--in-point",
            "2",
            "--out-point",
            "3.8",
        ]
    )
    assert args.command == "add-comp-layer"
    assert args.comp_id is None
    assert args.comp_name == "TX01_Title"
    assert args.name == "Title 01"
    assert args.start_time == 2.0
    assert args.in_point == 2.0
    assert args.out_point == 3.8


def test_build_parser_parses_set_footage_cut_by_name() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "set-footage-cut",
            "--layer-name",
            "Interview 01",
            "--source-in",
            "5",
            "--source-out",
            "9.5",
            "--timeline-in",
            "2",
        ]
    )
    assert args.command == "set-footage-cut"
    assert args.layer_name == "Interview 01"
    assert args.source_in == 5.0
    assert args.source_out == 9.5
    assert args.timeline_in == 2.0


def test_build_parser_parses_get_layer_audio() -> None:
    parser = build_parser()
    args = parser.parse_args(["get-layer-audio", "--layer-id", "3"])
    assert args.command == "get-layer-audio"
    assert args.layer_id == 3
    assert args.layer_name is None


def test_build_parser_parses_set_layer_audio() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "set-layer-audio",
            "--layer-name",
            "Interview 01",
            "--unmute",
            "--level-db",
            "-6",
            "--fade-in",
            "0.5",
            "--fade-out",
            "0.75",
        ]
    )
    assert args.command == "set-layer-audio"
    assert args.layer_name == "Interview 01"
    assert args.muted is False
    assert args.level_db == -6.0
    assert args.fade_in == 0.5
    assert args.fade_out == 0.75


def test_build_parser_parses_list_fonts() -> None:
    parser = build_parser()
    args = parser.parse_args(["list-fonts", "--query", "Noto Sans", "--limit", "20"])
    assert args.command == "list-fonts"
    assert args.query == "Noto Sans"
    assert args.limit == 20


def test_build_parser_parses_get_text_style() -> None:
    parser = build_parser()
    args = parser.parse_args(
        ["get-text-style", "--layer-name", "Title", "--comp-name", "TX01_Title"]
    )
    assert args.command == "get-text-style"
    assert args.layer_name == "Title"
    assert args.comp_name == "TX01_Title"


def test_build_parser_parses_set_text_style() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "set-text-style",
            "--layer-id",
            "2",
            "--font",
            "ArialMT",
            "--font-size",
            "96",
            "--fill-color",
            "255",
            "240",
            "210",
            "--enable-stroke",
            "--stroke-color",
            "18",
            "34",
            "56",
            "--stroke-width",
            "4",
            "--stroke-under-fill",
            "--tracking",
            "20",
            "--leading",
            "110",
            "--justification",
            "center",
        ]
    )
    assert args.command == "set-text-style"
    assert args.font == "ArialMT"
    assert args.font_size == 96
    assert args.fill_color == [255, 240, 210]
    assert args.stroke_enabled is True
    assert args.stroke_color == [18, 34, 56]
    assert args.stroke_width == 4
    assert args.stroke_over_fill is False
    assert args.tracking == 20
    assert args.leading == 110
    assert args.justification == "center"


def test_build_parser_parses_align_layers_by_name() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "align-layers",
            "--layer-name",
            "Title",
            "--layer-name",
            "Subtitle",
            "--horizontal",
            "center",
            "--vertical",
            "top",
            "--reference",
            "title-safe",
            "--margin-percent",
            "18",
            "--offset",
            "0",
            "24",
            "--time",
            "1.5",
        ]
    )
    assert args.command == "align-layers"
    assert args.layer_names == ["Title", "Subtitle"]
    assert args.layer_ids is None
    assert args.horizontal == "center"
    assert args.vertical == "top"
    assert args.reference == "title-safe"
    assert args.margin_percent == 18
    assert args.offset == [0, 24]
    assert args.time == 1.5


def test_build_parser_parses_distribute_layers_by_id() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "distribute-layers",
            "--layer-id",
            "5",
            "--layer-id",
            "3",
            "--layer-id",
            "1",
            "--axis",
            "horizontal",
            "--mode",
            "gaps",
            "--reference",
            "action-safe",
        ]
    )
    assert args.command == "distribute-layers"
    assert args.layer_ids == [5, 3, 1]
    assert args.layer_names is None
    assert args.axis == "horizontal"
    assert args.mode == "gaps"
    assert args.reference == "action-safe"


def test_build_parser_parses_expression_errors() -> None:
    parser = build_parser()
    args = parser.parse_args(["expression-errors", "--comp-name", "TX01_Title"])
    assert args.command == "expression-errors"
    assert args.comp_name == "TX01_Title"


def test_build_parser_parses_query_inspection_options() -> None:
    parser = build_parser()

    layers_args = parser.parse_args(["layers", "--comp-id", "17"])
    assert layers_args.comp_id == 17

    properties_args = parser.parse_args(
        [
            "properties",
            "--layer-name",
            "Title",
            "--comp-name",
            "TX01_Title",
            "--include-keyframes",
        ]
    )
    assert properties_args.comp_name == "TX01_Title"
    assert properties_args.include_keyframes is True

    bounds_args = parser.parse_args(
        ["bounds", "--layer-id", "2", "--comp-id", "17", "--time", "1.25"]
    )
    assert bounds_args.command == "bounds"
    assert bounds_args.layer_id == 2
    assert bounds_args.comp_id == 17
    assert bounds_args.time == 1.25

    snapshot_args = parser.parse_args(
        [
            "snapshot",
            "--comp-name",
            "TX01_Title",
            "--time",
            "1.25",
            "--out",
            "/tmp/frame.png",
            "--scale",
            "0.5",
        ]
    )
    assert snapshot_args.command == "snapshot"
    assert snapshot_args.comp_name == "TX01_Title"
    assert snapshot_args.time == 1.25
    assert snapshot_args.out == "/tmp/frame.png"
    assert snapshot_args.scale == 0.5


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


def test_build_parser_parses_add_essential_property() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "add-essential-property",
            "--layer-name",
            "SearchText",
            "--property-path",
            "ADBE Text Properties.ADBE Text Document",
            "--essential-name",
            "Search Word",
        ]
    )
    assert args.command == "add-essential-property"
    assert args.layer_name == "SearchText"
    assert args.property_path == "ADBE Text Properties.ADBE Text Document"
    assert args.essential_name == "Search Word"


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


def test_build_parser_parses_apply_scene() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "apply-scene",
            "--scene-file",
            "examples/scene.example.json",
            "--expect-project",
            "/projects/main.aep",
            "--validate-only",
        ]
    )
    assert args.command == "apply-scene"
    assert args.scene_file == "examples/scene.example.json"
    assert args.expect_project == "/projects/main.aep"
    assert args.validate_only is True
    assert args.mode == "merge"


def test_build_parser_parses_apply_scene_mode() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "apply-scene",
            "--scene-file",
            "examples/scene.example.json",
            "--mode",
            "clear-all",
        ]
    )
    assert args.command == "apply-scene"
    assert args.scene_file == "examples/scene.example.json"
    assert args.validate_only is False
    assert args.mode == "clear-all"


def test_run_command_returns_2_for_unknown_command(capsys) -> None:
    args = SimpleNamespace(command="unknown", base_url="http://x", timeout=1.0)
    code = run_command(args)
    captured = capsys.readouterr()
    assert code == 2
    assert "Unknown command" in captured.err


def test_run_set_layer_audio_requires_a_setting(capsys) -> None:
    parser = build_parser()
    args = parser.parse_args(["set-layer-audio", "--layer-id", "1"])
    code = run_command(args)
    captured = capsys.readouterr()
    assert code == 1
    assert "Provide --mute" in captured.err


def test_run_add_comp_layer_rejects_invalid_in_out(capsys) -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "add-comp-layer",
            "--comp-id",
            "12",
            "--in-point",
            "4",
            "--out-point",
            "3",
        ]
    )
    code = run_command(args)
    captured = capsys.readouterr()
    assert code == 1
    assert "--out-point must be greater" in captured.err


def test_run_set_layer_audio_rejects_negative_fade(capsys) -> None:
    parser = build_parser()
    args = parser.parse_args(
        ["set-layer-audio", "--layer-id", "1", "--fade-in", "-0.5"]
    )
    code = run_command(args)
    captured = capsys.readouterr()
    assert code == 1
    assert "--fade-in must be greater than or equal to 0" in captured.err


def test_run_set_text_style_requires_a_setting(capsys) -> None:
    parser = build_parser()
    args = parser.parse_args(["set-text-style", "--layer-id", "1"])
    code = run_command(args)
    captured = capsys.readouterr()
    assert code == 1
    assert "at least one text style option" in captured.err


def test_run_set_text_style_rejects_auto_and_manual_leading_value(capsys) -> None:
    parser = build_parser()
    args = parser.parse_args(
        ["set-text-style", "--layer-id", "1", "--leading", "100", "--auto-leading"]
    )
    code = run_command(args)
    captured = capsys.readouterr()
    assert code == 1
    assert "cannot be combined" in captured.err


def test_run_align_layers_requires_an_axis(capsys) -> None:
    parser = build_parser()
    args = parser.parse_args(["align-layers", "--layer-id", "1"])
    code = run_command(args)
    captured = capsys.readouterr()
    assert code == 1
    assert "Provide --horizontal" in captured.err


def test_run_distribute_layers_requires_two_layers(capsys) -> None:
    parser = build_parser()
    args = parser.parse_args(
        ["distribute-layers", "--layer-id", "1", "--axis", "horizontal"]
    )
    code = run_command(args)
    captured = capsys.readouterr()
    assert code == 1
    assert "at least two" in captured.err


def test_run_layout_rejects_margin_for_selection(capsys) -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "align-layers",
            "--layer-id",
            "1",
            "--horizontal",
            "center",
            "--reference",
            "selection",
            "--margin-percent",
            "10",
        ]
    )
    code = run_command(args)
    captured = capsys.readouterr()
    assert code == 1
    assert "cannot be used" in captured.err

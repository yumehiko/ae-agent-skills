from __future__ import annotations

import argparse
import os


DEFAULT_BRIDGE_URL = os.environ.get("AE_BRIDGE_URL", "http://127.0.0.1:8080")


def _add_layer_selector(parser: argparse.ArgumentParser) -> None:
    selector_group = parser.add_mutually_exclusive_group(required=True)
    selector_group.add_argument("--layer-id", type=int)
    selector_group.add_argument("--layer-name")


def _add_layer_list_selector(parser: argparse.ArgumentParser) -> None:
    selector_group = parser.add_mutually_exclusive_group(required=True)
    selector_group.add_argument("--layer-id", dest="layer_ids", type=int, action="append")
    selector_group.add_argument("--layer-name", dest="layer_names", action="append")


def _add_optional_comp_selector(parser: argparse.ArgumentParser) -> None:
    selector_group = parser.add_mutually_exclusive_group()
    selector_group.add_argument("--comp-id", type=int)
    selector_group.add_argument("--comp-name")


def _add_required_comp_selector(parser: argparse.ArgumentParser) -> None:
    selector_group = parser.add_mutually_exclusive_group(required=True)
    selector_group.add_argument("--comp-id", type=int)
    selector_group.add_argument("--comp-name")


def _add_layout_reference_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--reference",
        choices=["comp", "action-safe", "title-safe", "selection"],
        default="comp",
    )
    parser.add_argument("--margin-percent", type=float)
    parser.add_argument("--time", type=float, default=0.0)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ae-cli",
        description="Control After Effects CEP bridge without MCP.",
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BRIDGE_URL,
        help=f"After Effects bridge URL (default: {DEFAULT_BRIDGE_URL})",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=10.0,
        help="HTTP timeout in seconds (default: 10.0)",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("health", help="Check bridge health")
    layers_parser = subparsers.add_parser("layers", help="Get layers without changing the active comp")
    _add_optional_comp_selector(layers_parser)
    layers_parser.add_argument(
        "--brief",
        action="store_true",
        help="Return only layer identity fields (id, layerUid, name, type, and isNull)",
    )
    subparsers.add_parser("list-comps", help="List compositions in the current project")
    subparsers.add_parser("list-footage", help="List file-based footage items in the current project")
    subparsers.add_parser("selected-properties", help="Get currently selected properties")
    expression_errors_parser = subparsers.add_parser(
        "expression-errors",
        help="Get expression errors without changing the active comp",
    )
    _add_optional_comp_selector(expression_errors_parser)

    create_comp_parser = subparsers.add_parser("create-comp", help="Create a composition")
    create_comp_parser.add_argument("--name", required=True)
    create_comp_parser.add_argument("--width", type=int, required=True)
    create_comp_parser.add_argument("--height", type=int, required=True)
    create_comp_parser.add_argument("--duration", type=float, required=True)
    create_comp_parser.add_argument("--frame-rate", type=float, required=True)
    create_comp_parser.add_argument(
        "--pixel-aspect",
        type=float,
        default=1.0,
        help="Pixel aspect ratio (default: 1.0)",
    )

    set_active_comp_parser = subparsers.add_parser(
        "set-active-comp",
        help="Set the active composition by id or name",
    )
    set_active_group = set_active_comp_parser.add_mutually_exclusive_group(required=True)
    set_active_group.add_argument("--comp-id", type=int)
    set_active_group.add_argument("--comp-name")

    import_footage_parser = subparsers.add_parser(
        "import-footage",
        help="Import a footage file, reusing an existing item with the same path",
    )
    import_footage_parser.add_argument("--path", required=True, help="Absolute path to a footage file")
    import_footage_parser.add_argument("--name", help="Optional project item name")

    add_footage_layer_parser = subparsers.add_parser(
        "add-footage-layer",
        help="Add a footage item to a target composition and optionally cut its source range",
    )
    _add_optional_comp_selector(add_footage_layer_parser)
    footage_source_group = add_footage_layer_parser.add_mutually_exclusive_group(required=True)
    footage_source_group.add_argument("--footage-id", type=int, help="Project item id")
    footage_source_group.add_argument("--footage-name", help="Unique project item name")
    footage_source_group.add_argument(
        "--path",
        help="Absolute file path; imports the footage first when it is not already in the project",
    )
    add_footage_layer_parser.add_argument("--name", help="Optional layer name")
    add_footage_layer_parser.add_argument("--source-in", type=float, help="Source start time in seconds")
    add_footage_layer_parser.add_argument("--source-out", type=float, help="Source end time in seconds")
    add_footage_layer_parser.add_argument(
        "--timeline-in",
        type=float,
        help="Composition time where the selected source range starts (default: 0)",
    )

    add_comp_layer_parser = subparsers.add_parser(
        "add-comp-layer",
        help="Add an existing project composition as a layer in a target composition",
    )
    comp_source_group = add_comp_layer_parser.add_mutually_exclusive_group(required=True)
    comp_source_group.add_argument("--comp-id", type=int, help="Source composition project item id")
    comp_source_group.add_argument("--comp-name", help="Unique source composition name")
    add_comp_layer_parser.add_argument("--name", help="Optional layer name")
    add_comp_layer_parser.add_argument("--start-time", type=float, help="Layer start time in seconds")
    add_comp_layer_parser.add_argument("--in-point", type=float, help="Layer in point in seconds")
    add_comp_layer_parser.add_argument("--out-point", type=float, help="Layer out point in seconds")
    target_comp_group = add_comp_layer_parser.add_mutually_exclusive_group()
    target_comp_group.add_argument("--target-comp-id", type=int, help="Target composition id")
    target_comp_group.add_argument("--target-comp-name", help="Unique target composition name")

    set_footage_cut_parser = subparsers.add_parser(
        "set-footage-cut",
        help="Set the source range and timeline placement of an existing footage layer",
    )
    _add_layer_selector(set_footage_cut_parser)
    _add_optional_comp_selector(set_footage_cut_parser)
    set_footage_cut_parser.add_argument("--source-in", type=float, required=True)
    set_footage_cut_parser.add_argument("--source-out", type=float, required=True)
    set_footage_cut_parser.add_argument("--timeline-in", type=float, required=True)

    get_layer_audio_parser = subparsers.add_parser(
        "get-layer-audio",
        help="Get mute, level, and Audio Levels keyframes for a layer",
    )
    _add_layer_selector(get_layer_audio_parser)

    set_layer_audio_parser = subparsers.add_parser(
        "set-layer-audio",
        help="Set mute, volume, and fade durations for an audio-capable layer",
    )
    _add_layer_selector(set_layer_audio_parser)
    _add_optional_comp_selector(set_layer_audio_parser)
    mute_group = set_layer_audio_parser.add_mutually_exclusive_group()
    mute_group.add_argument("--mute", dest="muted", action="store_true")
    mute_group.add_argument("--unmute", dest="muted", action="store_false")
    set_layer_audio_parser.set_defaults(muted=None)
    set_layer_audio_parser.add_argument("--level-db", type=float, help="Audio level in dB")
    set_layer_audio_parser.add_argument("--fade-in", type=float, help="Fade-in duration in seconds")
    set_layer_audio_parser.add_argument("--fade-out", type=float, help="Fade-out duration in seconds")

    list_fonts_parser = subparsers.add_parser(
        "list-fonts",
        help="List installed fonts and their PostScript names",
    )
    list_fonts_parser.add_argument("--query", help="Filter by font, family, or style name")
    list_fonts_parser.add_argument("--limit", type=int, default=200, help="Maximum results (default: 200)")

    get_text_style_parser = subparsers.add_parser(
        "get-text-style",
        help="Get the whole-layer text style for a text layer",
    )
    _add_layer_selector(get_text_style_parser)
    _add_optional_comp_selector(get_text_style_parser)

    set_text_style_parser = subparsers.add_parser(
        "set-text-style",
        help="Set whole-layer font, fill, stroke, spacing, and paragraph style",
    )
    _add_layer_selector(set_text_style_parser)
    _add_optional_comp_selector(set_text_style_parser)
    set_text_style_parser.add_argument("--font", help="PostScript font name; discover with list-fonts")
    set_text_style_parser.add_argument("--font-size", type=float)
    fill_group = set_text_style_parser.add_mutually_exclusive_group()
    fill_group.add_argument("--enable-fill", dest="fill_enabled", action="store_true")
    fill_group.add_argument("--disable-fill", dest="fill_enabled", action="store_false")
    set_text_style_parser.set_defaults(fill_enabled=None)
    set_text_style_parser.add_argument("--fill-color", nargs=3, type=float, metavar=("R", "G", "B"))
    stroke_group = set_text_style_parser.add_mutually_exclusive_group()
    stroke_group.add_argument("--enable-stroke", dest="stroke_enabled", action="store_true")
    stroke_group.add_argument("--disable-stroke", dest="stroke_enabled", action="store_false")
    set_text_style_parser.set_defaults(stroke_enabled=None)
    set_text_style_parser.add_argument("--stroke-color", nargs=3, type=float, metavar=("R", "G", "B"))
    set_text_style_parser.add_argument("--stroke-width", type=float)
    stroke_order_group = set_text_style_parser.add_mutually_exclusive_group()
    stroke_order_group.add_argument("--stroke-over-fill", dest="stroke_over_fill", action="store_true")
    stroke_order_group.add_argument("--stroke-under-fill", dest="stroke_over_fill", action="store_false")
    set_text_style_parser.set_defaults(stroke_over_fill=None)
    set_text_style_parser.add_argument("--tracking", type=float)
    set_text_style_parser.add_argument("--leading", type=float)
    leading_group = set_text_style_parser.add_mutually_exclusive_group()
    leading_group.add_argument("--auto-leading", dest="auto_leading", action="store_true")
    leading_group.add_argument("--manual-leading", dest="auto_leading", action="store_false")
    set_text_style_parser.set_defaults(auto_leading=None)
    set_text_style_parser.add_argument(
        "--justification",
        choices=["left", "center", "right", "full-left", "full-center", "full-right", "full"],
    )

    set_text_style_ranges_parser = subparsers.add_parser(
        "set-text-style-ranges",
        help="Apply half-open per-character text styles from a JSON array (AE 24.3+)",
    )
    _add_layer_selector(set_text_style_ranges_parser)
    _add_optional_comp_selector(set_text_style_ranges_parser)
    set_text_style_ranges_parser.add_argument(
        "--ranges-file",
        required=True,
        help="UTF-8 JSON file containing an array of {start,end,style}",
    )

    set_text_animators_parser = subparsers.add_parser(
        "set-text-animators",
        help="Replace managed Range Selector text animators from a JSON array",
    )
    _add_layer_selector(set_text_animators_parser)
    _add_optional_comp_selector(set_text_animators_parser)
    set_text_animators_parser.add_argument(
        "--animators-file",
        required=True,
        help="UTF-8 JSON file containing text animator declarations",
    )

    align_layers_parser = subparsers.add_parser(
        "align-layers",
        help="Align visual layer bounds to the comp, safe area, or selected bounds",
    )
    _add_layer_list_selector(align_layers_parser)
    _add_optional_comp_selector(align_layers_parser)
    align_layers_parser.add_argument("--horizontal", choices=["left", "center", "right"])
    align_layers_parser.add_argument("--vertical", choices=["top", "center", "bottom"])
    align_layers_parser.add_argument("--offset", nargs=2, type=float, metavar=("X", "Y"))
    _add_layout_reference_options(align_layers_parser)

    distribute_layers_parser = subparsers.add_parser(
        "distribute-layers",
        help="Distribute visual layer bounds with equal gaps or center spacing",
    )
    _add_layer_list_selector(distribute_layers_parser)
    _add_optional_comp_selector(distribute_layers_parser)
    distribute_layers_parser.add_argument(
        "--axis",
        choices=["horizontal", "vertical"],
        required=True,
    )
    distribute_layers_parser.add_argument(
        "--mode",
        choices=["gaps", "centers"],
        default="gaps",
    )
    _add_layout_reference_options(distribute_layers_parser)

    visual_center_parser = subparsers.add_parser(
        "visual-center",
        help="Move layer anchor points to visual centers without changing appearance",
    )
    _add_layer_list_selector(visual_center_parser)
    _add_optional_comp_selector(visual_center_parser)
    visual_center_parser.add_argument("--time", type=float, default=0.0)

    properties_parser = subparsers.add_parser("properties", help="Get properties for a layer")
    _add_layer_selector(properties_parser)
    _add_optional_comp_selector(properties_parser)
    properties_parser.add_argument("--include-group", action="append", default=[])
    properties_parser.add_argument("--exclude-group", action="append", default=[])
    properties_parser.add_argument(
        "--property-path",
        help="Read one exact matchName-based property path, including non-enumerated properties",
    )
    properties_parser.add_argument("--max-depth", type=int)
    properties_parser.add_argument("--include-group-children", action="store_true")
    properties_parser.add_argument("--include-keyframes", action="store_true")
    properties_parser.add_argument(
        "--include-expression",
        action="store_true",
        help="Include expression source and enabled state for expression-capable properties",
    )
    properties_parser.add_argument(
        "--include-disabled",
        action="store_true",
        help="Include disabled or otherwise normally hidden property nodes for diagnostics",
    )
    properties_parser.add_argument(
        "--filter",
        dest="property_filter",
        help="Only print properties whose name or path matches this regular expression",
    )
    properties_parser.add_argument("--time", type=float, help="Evaluate properties at the specified comp time")

    bounds_parser = subparsers.add_parser(
        "bounds",
        help="Get visual layer bounds in composition coordinates",
    )
    _add_layer_selector(bounds_parser)
    _add_optional_comp_selector(bounds_parser)
    bounds_parser.add_argument("--time", type=float, default=0.0)

    snapshot_parser = subparsers.add_parser(
        "snapshot",
        help="Render one composition frame to a new PNG file",
    )
    _add_required_comp_selector(snapshot_parser)
    snapshot_parser.add_argument("--time", type=float, default=0.0)
    snapshot_parser.add_argument("--out", required=True, help="Output PNG path")
    snapshot_parser.add_argument(
        "--scale",
        type=float,
        default=1.0,
        help="Output scale greater than 0 and at most 1 (default: 1)",
    )

    expression_parser = subparsers.add_parser("set-expression", help="Set expression on a property")
    _add_layer_selector(expression_parser)
    _add_optional_comp_selector(expression_parser)
    expression_parser.add_argument("--property-path", required=True)
    expression_group = expression_parser.add_mutually_exclusive_group(required=True)
    expression_group.add_argument("--expression")
    expression_group.add_argument("--expression-file")

    property_value_parser = subparsers.add_parser("set-property", help="Set a property value")
    _add_layer_selector(property_value_parser)
    _add_optional_comp_selector(property_value_parser)
    property_value_parser.add_argument("--property-path", required=True)
    property_value_group = property_value_parser.add_mutually_exclusive_group(required=True)
    property_value_group.add_argument(
        "--value",
        help="JSON value (examples: 100, [960,540], true, \"Hello\")",
    )
    property_value_group.add_argument("--value-file", help="Path to a UTF-8 JSON file")

    essential_property_parser = subparsers.add_parser(
        "add-essential-property",
        help="Add a layer property to Essential Graphics",
    )
    _add_layer_selector(essential_property_parser)
    _add_optional_comp_selector(essential_property_parser)
    essential_property_parser.add_argument("--property-path", required=True)
    essential_property_parser.add_argument(
        "--essential-name",
        help="Display name in Essential Graphics panel",
    )

    keyframe_parser = subparsers.add_parser("set-keyframe", help="Set a keyframe value at time")
    _add_layer_selector(keyframe_parser)
    _add_optional_comp_selector(keyframe_parser)
    keyframe_parser.add_argument("--property-path", required=True)
    keyframe_parser.add_argument("--time", type=float, required=True)
    keyframe_group = keyframe_parser.add_mutually_exclusive_group(required=True)
    keyframe_group.add_argument(
        "--value",
        help="JSON value (examples: 100, [960,540], true, \"Hello\")",
    )
    keyframe_group.add_argument("--value-file", help="Path to a UTF-8 JSON file")
    keyframe_parser.add_argument(
        "--in-interp",
        choices=["linear", "bezier", "hold"],
        help="Incoming interpolation type for the keyframe",
    )
    keyframe_parser.add_argument(
        "--out-interp",
        choices=["linear", "bezier", "hold"],
        help="Outgoing interpolation type for the keyframe",
    )
    keyframe_parser.add_argument(
        "--ease-in",
        help='Incoming temporal ease as JSON. Example: "[0,66]" or "[[0,66],[0,66]]"',
    )
    keyframe_parser.add_argument(
        "--ease-out",
        help='Outgoing temporal ease as JSON. Example: "[0,66]" or "[[0,66],[0,66]]"',
    )

    effect_parser = subparsers.add_parser("add-effect", help="Add an effect to a layer")
    _add_layer_selector(effect_parser)
    _add_optional_comp_selector(effect_parser)
    effect_parser.add_argument("--effect-match-name", required=True)
    effect_parser.add_argument("--effect-name")

    shape_repeater_parser = subparsers.add_parser(
        "add-shape-repeater",
        help="Add a Repeater operator to a shape group",
    )
    _add_layer_selector(shape_repeater_parser)
    _add_optional_comp_selector(shape_repeater_parser)
    shape_repeater_parser.add_argument(
        "--group-index",
        type=int,
        default=1,
        help="1-based shape group index under Contents (default: 1)",
    )
    shape_repeater_parser.add_argument("--name", help="Optional repeater name")
    shape_repeater_parser.add_argument("--copies", type=float, help="Repeater copies")
    shape_repeater_parser.add_argument("--offset", type=float, help="Repeater offset")
    shape_repeater_parser.add_argument(
        "--position",
        nargs=2,
        type=float,
        metavar=("X", "Y"),
        help="Transform Position [x y]",
    )
    shape_repeater_parser.add_argument(
        "--scale",
        nargs=2,
        type=float,
        metavar=("X", "Y"),
        help="Transform Scale [x y]",
    )
    shape_repeater_parser.add_argument("--rotation", type=float, help="Transform Rotation")
    shape_repeater_parser.add_argument("--start-opacity", type=float, help="Transform Start Opacity (0-100)")
    shape_repeater_parser.add_argument("--end-opacity", type=float, help="Transform End Opacity (0-100)")

    layer_parser = subparsers.add_parser("add-layer", help="Add a layer to a target composition")
    _add_optional_comp_selector(layer_parser)
    layer_parser.add_argument(
        "--layer-type",
        choices=["text", "null", "solid", "shape"],
        default="null",
        help="Layer type to add (default: null)",
    )
    layer_parser.add_argument("--name", help="Optional layer name")
    layer_parser.add_argument("--text", help="Text content for text layers")
    layer_parser.add_argument("--width", type=int, help="Width for solid layers")
    layer_parser.add_argument("--height", type=int, help="Height for solid layers")
    layer_parser.add_argument(
        "--color",
        nargs=3,
        type=float,
        metavar=("R", "G", "B"),
        help="Color for solid layers (0-1 or 0-255)",
    )
    layer_parser.add_argument("--duration", type=float, help="Duration in seconds for solid layers")
    layer_parser.add_argument(
        "--shape-type",
        choices=["ellipse", "rect"],
        help="Primitive type for shape layers",
    )
    layer_parser.add_argument(
        "--shape-size",
        nargs=2,
        type=float,
        metavar=("W", "H"),
        help="Shape size [width height] in pixels",
    )
    layer_parser.add_argument(
        "--shape-position",
        nargs=2,
        type=float,
        metavar=("X", "Y"),
        help="Shape position [x y] in pixels in the shape group",
    )
    layer_parser.add_argument(
        "--shape-fill-color",
        nargs=3,
        type=float,
        metavar=("R", "G", "B"),
        help="Shape fill color (0-1 or 0-255)",
    )
    layer_parser.add_argument(
        "--shape-fill-opacity",
        type=float,
        help="Shape fill opacity (0-100)",
    )
    layer_parser.add_argument(
        "--shape-stroke-color",
        nargs=3,
        type=float,
        metavar=("R", "G", "B"),
        help="Shape stroke color (0-1 or 0-255)",
    )
    layer_parser.add_argument(
        "--shape-stroke-opacity",
        type=float,
        help="Shape stroke opacity (0-100)",
    )
    layer_parser.add_argument(
        "--shape-stroke-width",
        type=float,
        help="Shape stroke width in pixels",
    )
    layer_parser.add_argument(
        "--shape-stroke-line-cap",
        choices=["butt", "round", "projecting"],
        help="Shape stroke line cap style",
    )
    layer_parser.add_argument(
        "--shape-roundness",
        type=float,
        help="Rectangle roundness in pixels (rect only)",
    )

    set_in_out_parser = subparsers.add_parser("set-in-out-point", help="Set layer in/out points")
    _add_layer_selector(set_in_out_parser)
    _add_optional_comp_selector(set_in_out_parser)
    set_in_out_parser.add_argument("--in-point", type=float)
    set_in_out_parser.add_argument("--out-point", type=float)

    move_layer_time_parser = subparsers.add_parser("move-layer-time", help="Move layer timing by delta seconds")
    _add_layer_selector(move_layer_time_parser)
    _add_optional_comp_selector(move_layer_time_parser)
    move_layer_time_parser.add_argument("--delta", type=float, required=True)

    set_cti_parser = subparsers.add_parser("set-cti", help="Set current time indicator")
    _add_optional_comp_selector(set_cti_parser)
    set_cti_parser.add_argument("--time", type=float, required=True)

    set_work_area_parser = subparsers.add_parser("set-work-area", help="Set comp work area")
    _add_optional_comp_selector(set_work_area_parser)
    set_work_area_parser.add_argument("--start", type=float, required=True)
    set_work_area_parser.add_argument("--duration", type=float, required=True)

    parent_layer_parser = subparsers.add_parser("parent-layer", help="Set or clear layer parent")
    _add_optional_comp_selector(parent_layer_parser)
    parent_layer_parser.add_argument("--child-layer-id", type=int, required=True)
    parent_group = parent_layer_parser.add_mutually_exclusive_group(required=True)
    parent_group.add_argument("--parent-layer-id", type=int)
    parent_group.add_argument("--clear-parent", action="store_true")

    precompose_parser = subparsers.add_parser("precompose", help="Precompose layers")
    _add_optional_comp_selector(precompose_parser)
    precompose_parser.add_argument("--layer-id", type=int, action="append", required=True)
    precompose_parser.add_argument("--name", required=True)
    precompose_parser.add_argument(
        "--move-all-attributes",
        action="store_true",
        help="Move all attributes into the new composition",
    )

    duplicate_layer_parser = subparsers.add_parser("duplicate-layer", help="Duplicate a layer")
    _add_optional_comp_selector(duplicate_layer_parser)
    duplicate_layer_parser.add_argument("--layer-id", type=int, required=True)

    move_layer_order_parser = subparsers.add_parser("move-layer-order", help="Reorder a layer")
    _add_optional_comp_selector(move_layer_order_parser)
    move_layer_order_parser.add_argument("--layer-id", type=int, required=True)
    order_group = move_layer_order_parser.add_mutually_exclusive_group(required=True)
    order_group.add_argument("--before-layer-id", type=int)
    order_group.add_argument("--after-layer-id", type=int)
    order_group.add_argument("--to-top", action="store_true")
    order_group.add_argument("--to-bottom", action="store_true")

    delete_layer_parser = subparsers.add_parser("delete-layer", help="Delete a layer")
    _add_optional_comp_selector(delete_layer_parser)
    delete_layer_parser.add_argument("--layer-id", type=int, required=True)

    delete_comp_parser = subparsers.add_parser("delete-comp", help="Delete a composition by id or name")
    delete_comp_group = delete_comp_parser.add_mutually_exclusive_group(required=True)
    delete_comp_group.add_argument("--comp-id", type=int)
    delete_comp_group.add_argument("--comp-name")

    apply_scene_parser = subparsers.add_parser(
        "apply-scene",
        help="Apply a declarative scene JSON to After Effects",
    )
    apply_scene_parser.add_argument(
        "--scene-file",
        required=True,
        help="Path to a UTF-8 scene JSON file",
    )
    apply_scene_parser.add_argument(
        "--expect-project",
        help=(
            "Expected After Effects project path. The path is resolved to an absolute path, "
            "and apply-scene aborts before mutation when it does not match the open project"
        ),
    )
    apply_scene_parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate and plan without mutating the active project",
    )
    apply_scene_parser.add_argument(
        "--mode",
        choices=["merge", "replace-managed", "clear-all"],
        default="merge",
        help=(
            "Scene apply strategy: merge (upsert only), replace-managed "
            "(delete managed layers not declared), clear-all (delete all comp layers first)"
        ),
    )

    return parser

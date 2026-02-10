from __future__ import annotations

import argparse
import os


DEFAULT_BRIDGE_URL = os.environ.get("AE_BRIDGE_URL", "http://127.0.0.1:8080")


def _add_layer_selector(parser: argparse.ArgumentParser) -> None:
    selector_group = parser.add_mutually_exclusive_group(required=True)
    selector_group.add_argument("--layer-id", type=int)
    selector_group.add_argument("--layer-name")


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
    subparsers.add_parser("layers", help="Get active composition layers")
    subparsers.add_parser("list-comps", help="List compositions in the current project")
    subparsers.add_parser("selected-properties", help="Get currently selected properties")

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

    properties_parser = subparsers.add_parser("properties", help="Get properties for a layer")
    _add_layer_selector(properties_parser)
    properties_parser.add_argument("--include-group", action="append", default=[])
    properties_parser.add_argument("--exclude-group", action="append", default=[])
    properties_parser.add_argument("--max-depth", type=int)
    properties_parser.add_argument("--include-group-children", action="store_true")
    properties_parser.add_argument("--time", type=float, help="Evaluate properties at the specified comp time")

    expression_parser = subparsers.add_parser("set-expression", help="Set expression on a property")
    _add_layer_selector(expression_parser)
    expression_parser.add_argument("--property-path", required=True)
    expression_group = expression_parser.add_mutually_exclusive_group(required=True)
    expression_group.add_argument("--expression")
    expression_group.add_argument("--expression-file")

    property_value_parser = subparsers.add_parser("set-property", help="Set a property value")
    _add_layer_selector(property_value_parser)
    property_value_parser.add_argument("--property-path", required=True)
    property_value_group = property_value_parser.add_mutually_exclusive_group(required=True)
    property_value_group.add_argument(
        "--value",
        help="JSON value (examples: 100, [960,540], true, \"Hello\")",
    )
    property_value_group.add_argument("--value-file", help="Path to a UTF-8 JSON file")

    keyframe_parser = subparsers.add_parser("set-keyframe", help="Set a keyframe value at time")
    _add_layer_selector(keyframe_parser)
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
    effect_parser.add_argument("--effect-match-name", required=True)
    effect_parser.add_argument("--effect-name")

    shape_repeater_parser = subparsers.add_parser(
        "add-shape-repeater",
        help="Add a Repeater operator to a shape group",
    )
    _add_layer_selector(shape_repeater_parser)
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

    layer_parser = subparsers.add_parser("add-layer", help="Add a layer to the active composition")
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
    set_in_out_parser.add_argument("--in-point", type=float)
    set_in_out_parser.add_argument("--out-point", type=float)

    move_layer_time_parser = subparsers.add_parser("move-layer-time", help="Move layer timing by delta seconds")
    _add_layer_selector(move_layer_time_parser)
    move_layer_time_parser.add_argument("--delta", type=float, required=True)

    set_cti_parser = subparsers.add_parser("set-cti", help="Set current time indicator")
    set_cti_parser.add_argument("--time", type=float, required=True)

    set_work_area_parser = subparsers.add_parser("set-work-area", help="Set comp work area")
    set_work_area_parser.add_argument("--start", type=float, required=True)
    set_work_area_parser.add_argument("--duration", type=float, required=True)

    parent_layer_parser = subparsers.add_parser("parent-layer", help="Set or clear layer parent")
    parent_layer_parser.add_argument("--child-layer-id", type=int, required=True)
    parent_group = parent_layer_parser.add_mutually_exclusive_group(required=True)
    parent_group.add_argument("--parent-layer-id", type=int)
    parent_group.add_argument("--clear-parent", action="store_true")

    precompose_parser = subparsers.add_parser("precompose", help="Precompose layers")
    precompose_parser.add_argument("--layer-id", type=int, action="append", required=True)
    precompose_parser.add_argument("--name", required=True)
    precompose_parser.add_argument(
        "--move-all-attributes",
        action="store_true",
        help="Move all attributes into the new composition",
    )

    duplicate_layer_parser = subparsers.add_parser("duplicate-layer", help="Duplicate a layer")
    duplicate_layer_parser.add_argument("--layer-id", type=int, required=True)

    move_layer_order_parser = subparsers.add_parser("move-layer-order", help="Reorder a layer")
    move_layer_order_parser.add_argument("--layer-id", type=int, required=True)
    order_group = move_layer_order_parser.add_mutually_exclusive_group(required=True)
    order_group.add_argument("--before-layer-id", type=int)
    order_group.add_argument("--after-layer-id", type=int)
    order_group.add_argument("--to-top", action="store_true")
    order_group.add_argument("--to-bottom", action="store_true")

    delete_layer_parser = subparsers.add_parser("delete-layer", help="Delete a layer")
    delete_layer_parser.add_argument("--layer-id", type=int, required=True)

    delete_comp_parser = subparsers.add_parser("delete-comp", help="Delete a composition by id or name")
    delete_comp_group = delete_comp_parser.add_mutually_exclusive_group(required=True)
    delete_comp_group.add_argument("--comp-id", type=int)
    delete_comp_group.add_argument("--comp-name")

    return parser

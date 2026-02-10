from __future__ import annotations

import argparse
import os


DEFAULT_BRIDGE_URL = os.environ.get("AE_BRIDGE_URL", "http://127.0.0.1:8080")


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
    subparsers.add_parser("selected-properties", help="Get currently selected properties")

    properties_parser = subparsers.add_parser("properties", help="Get properties for a layer")
    properties_parser.add_argument("--layer-id", type=int, required=True)
    properties_parser.add_argument("--include-group", action="append", default=[])
    properties_parser.add_argument("--exclude-group", action="append", default=[])
    properties_parser.add_argument("--max-depth", type=int)

    expression_parser = subparsers.add_parser("set-expression", help="Set expression on a property")
    expression_parser.add_argument("--layer-id", type=int, required=True)
    expression_parser.add_argument("--property-path", required=True)
    expression_group = expression_parser.add_mutually_exclusive_group(required=True)
    expression_group.add_argument("--expression")
    expression_group.add_argument("--expression-file")

    effect_parser = subparsers.add_parser("add-effect", help="Add an effect to a layer")
    effect_parser.add_argument("--layer-id", type=int, required=True)
    effect_parser.add_argument("--effect-match-name", required=True)
    effect_parser.add_argument("--effect-name")

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

    return parser

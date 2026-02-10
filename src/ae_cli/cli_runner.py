from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Callable

import requests

from .client import AEBridgeError, AEClient


def _print_json(data: Any) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2))


def _read_expression(args: argparse.Namespace) -> str:
    if args.expression_file:
        return Path(args.expression_file).read_text(encoding="utf-8")
    return args.expression


def _read_json_value(args: argparse.Namespace) -> Any:
    if getattr(args, "value_file", None):
        raw = Path(args.value_file).read_text(encoding="utf-8")
    else:
        raw = args.value
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON value: {exc}") from exc


def _read_json_optional(raw: str | None, label: str) -> Any:
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON for {label}: {exc}") from exc


def _layer_selector_kwargs(args: argparse.Namespace) -> dict[str, Any]:
    return {
        "layer_id": getattr(args, "layer_id", None),
        "layer_name": getattr(args, "layer_name", None),
    }


def _run_health(client: AEClient, _args: argparse.Namespace) -> None:
    _print_json(client.health())


def _run_layers(client: AEClient, _args: argparse.Namespace) -> None:
    _print_json(client.get_layers())


def _run_list_comps(client: AEClient, _args: argparse.Namespace) -> None:
    _print_json(client.list_comps())


def _run_create_comp(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(
        client.create_comp(
            name=args.name,
            width=args.width,
            height=args.height,
            duration=args.duration,
            frame_rate=args.frame_rate,
            pixel_aspect=args.pixel_aspect,
        )
    )


def _run_set_active_comp(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(client.set_active_comp(comp_id=args.comp_id, comp_name=args.comp_name))


def _run_selected_properties(client: AEClient, _args: argparse.Namespace) -> None:
    _print_json(client.get_selected_properties())


def _run_properties(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(
        client.get_properties(
            **_layer_selector_kwargs(args),
            include_groups=args.include_group,
            exclude_groups=args.exclude_group,
            max_depth=args.max_depth,
            include_group_children=args.include_group_children,
            time=args.time,
        )
    )


def _run_set_expression(client: AEClient, args: argparse.Namespace) -> None:
    expression = _read_expression(args)
    _print_json(
        client.set_expression(
            property_path=args.property_path,
            expression=expression,
            **_layer_selector_kwargs(args),
        )
    )


def _run_set_property(client: AEClient, args: argparse.Namespace) -> None:
    value = _read_json_value(args)
    _print_json(
        client.set_property_value(
            property_path=args.property_path,
            value=value,
            **_layer_selector_kwargs(args),
        )
    )


def _run_set_keyframe(client: AEClient, args: argparse.Namespace) -> None:
    value = _read_json_value(args)
    ease_in = _read_json_optional(args.ease_in, "ease-in")
    ease_out = _read_json_optional(args.ease_out, "ease-out")
    _print_json(
        client.set_keyframe(
            property_path=args.property_path,
            time=args.time,
            value=value,
            in_interp=args.in_interp,
            out_interp=args.out_interp,
            ease_in=ease_in,
            ease_out=ease_out,
            **_layer_selector_kwargs(args),
        )
    )


def _run_add_effect(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(
        client.add_effect(
            effect_match_name=args.effect_match_name,
            effect_name=args.effect_name,
            **_layer_selector_kwargs(args),
        )
    )


def _run_add_shape_repeater(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(
        client.add_shape_repeater(
            group_index=args.group_index,
            name=args.name,
            copies=args.copies,
            offset=args.offset,
            position=args.position,
            scale=args.scale,
            rotation=args.rotation,
            start_opacity=args.start_opacity,
            end_opacity=args.end_opacity,
            **_layer_selector_kwargs(args),
        )
    )


def _run_add_layer(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(
        client.add_layer(
            layer_type=args.layer_type,
            name=args.name,
            text=args.text,
            width=args.width,
            height=args.height,
            color=args.color,
            duration=args.duration,
            shape_type=args.shape_type,
            shape_size=args.shape_size,
            shape_position=args.shape_position,
            shape_fill_color=args.shape_fill_color,
            shape_fill_opacity=args.shape_fill_opacity,
            shape_stroke_color=args.shape_stroke_color,
            shape_stroke_opacity=args.shape_stroke_opacity,
            shape_stroke_width=args.shape_stroke_width,
            shape_stroke_line_cap=args.shape_stroke_line_cap,
            shape_roundness=args.shape_roundness,
        )
    )


def _run_set_in_out_point(client: AEClient, args: argparse.Namespace) -> None:
    if args.in_point is None and args.out_point is None:
        raise ValueError("At least one of --in-point or --out-point is required.")
    _print_json(
        client.set_in_out_point(
            in_point=args.in_point,
            out_point=args.out_point,
            **_layer_selector_kwargs(args),
        )
    )


def _run_move_layer_time(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(client.move_layer_time(delta=args.delta, **_layer_selector_kwargs(args)))


def _run_set_cti(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(client.set_cti(time=args.time))


def _run_set_work_area(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(client.set_work_area(start=args.start, duration=args.duration))


def _run_parent_layer(client: AEClient, args: argparse.Namespace) -> None:
    parent_layer_id = None if args.clear_parent else args.parent_layer_id
    _print_json(
        client.parent_layer(
            child_layer_id=args.child_layer_id,
            parent_layer_id=parent_layer_id,
        )
    )


def _run_precompose(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(
        client.precompose(
            layer_ids=args.layer_id,
            name=args.name,
            move_all_attributes=args.move_all_attributes,
        )
    )


def _run_duplicate_layer(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(client.duplicate_layer(layer_id=args.layer_id))


def _run_move_layer_order(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(
        client.move_layer_order(
            layer_id=args.layer_id,
            before_layer_id=args.before_layer_id,
            after_layer_id=args.after_layer_id,
            to_top=args.to_top,
            to_bottom=args.to_bottom,
        )
    )


def _run_delete_layer(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(client.delete_layer(layer_id=args.layer_id))


def _run_delete_comp(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(client.delete_comp(comp_id=args.comp_id, comp_name=args.comp_name))


CommandHandler = Callable[[AEClient, argparse.Namespace], None]

COMMAND_HANDLERS: dict[str, CommandHandler] = {
    "health": _run_health,
    "layers": _run_layers,
    "list-comps": _run_list_comps,
    "create-comp": _run_create_comp,
    "set-active-comp": _run_set_active_comp,
    "selected-properties": _run_selected_properties,
    "properties": _run_properties,
    "set-expression": _run_set_expression,
    "set-property": _run_set_property,
    "set-keyframe": _run_set_keyframe,
    "add-effect": _run_add_effect,
    "add-shape-repeater": _run_add_shape_repeater,
    "add-layer": _run_add_layer,
    "set-in-out-point": _run_set_in_out_point,
    "move-layer-time": _run_move_layer_time,
    "set-cti": _run_set_cti,
    "set-work-area": _run_set_work_area,
    "parent-layer": _run_parent_layer,
    "precompose": _run_precompose,
    "duplicate-layer": _run_duplicate_layer,
    "move-layer-order": _run_move_layer_order,
    "delete-layer": _run_delete_layer,
    "delete-comp": _run_delete_comp,
}


def run_command(args: argparse.Namespace) -> int:
    client = AEClient(base_url=args.base_url, timeout=args.timeout)

    try:
        handler = COMMAND_HANDLERS.get(args.command)
        if handler is None:
            print(f"ae-cli error: Unknown command: {args.command}", file=sys.stderr)
            return 2
        handler(client, args)
        return 0
    except (AEBridgeError, requests.RequestException, OSError, ValueError) as exc:
        print(f"ae-cli error: {exc}", file=sys.stderr)
        return 1

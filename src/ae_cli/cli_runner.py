from __future__ import annotations

import argparse
import json
import math
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


def _read_json_file(path: str, label: str) -> Any:
    raw = Path(path).read_text(encoding="utf-8")
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


def _run_list_footage(client: AEClient, _args: argparse.Namespace) -> None:
    _print_json(client.list_footage())


def _run_import_footage(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(client.import_footage(path=args.path, name=args.name))


def _run_add_footage_layer(client: AEClient, args: argparse.Namespace) -> None:
    if (args.source_in is None) != (args.source_out is None):
        raise ValueError("--source-in and --source-out must be provided together.")
    if args.source_in is not None and args.source_out <= args.source_in:
        raise ValueError("--source-out must be greater than --source-in.")
    if args.source_in is not None and args.source_in < 0:
        raise ValueError("--source-in must be greater than or equal to 0.")
    if args.timeline_in is not None and args.timeline_in < 0:
        raise ValueError("--timeline-in must be greater than or equal to 0.")
    _print_json(
        client.add_footage_layer(
            footage_id=args.footage_id,
            footage_name=args.footage_name,
            path=args.path,
            name=args.name,
            source_in=args.source_in,
            source_out=args.source_out,
            timeline_in=args.timeline_in,
        )
    )


def _run_set_footage_cut(client: AEClient, args: argparse.Namespace) -> None:
    if args.source_in < 0:
        raise ValueError("--source-in must be greater than or equal to 0.")
    if args.source_out <= args.source_in:
        raise ValueError("--source-out must be greater than --source-in.")
    if args.timeline_in < 0:
        raise ValueError("--timeline-in must be greater than or equal to 0.")
    _print_json(
        client.set_footage_cut(
            source_in=args.source_in,
            source_out=args.source_out,
            timeline_in=args.timeline_in,
            **_layer_selector_kwargs(args),
        )
    )


def _run_get_layer_audio(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(client.get_layer_audio(**_layer_selector_kwargs(args)))


def _run_set_layer_audio(client: AEClient, args: argparse.Namespace) -> None:
    if all(
        value is None
        for value in (args.muted, args.level_db, args.fade_in, args.fade_out)
    ):
        raise ValueError("Provide --mute, --unmute, --level-db, --fade-in, or --fade-out.")
    if args.level_db is not None and not -192 <= args.level_db <= 24:
        raise ValueError("--level-db must be between -192 and 24.")
    if args.fade_in is not None and args.fade_in < 0:
        raise ValueError("--fade-in must be greater than or equal to 0.")
    if args.fade_out is not None and args.fade_out < 0:
        raise ValueError("--fade-out must be greater than or equal to 0.")
    _print_json(
        client.set_layer_audio(
            muted=args.muted,
            level_db=args.level_db,
            fade_in=args.fade_in,
            fade_out=args.fade_out,
            **_layer_selector_kwargs(args),
        )
    )


def _run_list_fonts(client: AEClient, args: argparse.Namespace) -> None:
    if args.limit <= 0:
        raise ValueError("--limit must be a positive integer.")
    _print_json(client.list_fonts(query=args.query, limit=args.limit))


def _run_get_text_style(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(client.get_text_style(**_layer_selector_kwargs(args)))


def _validate_text_color(value: list[float] | None, label: str) -> None:
    if value is not None and any(
        not math.isfinite(component) or component < 0 or component > 255
        for component in value
    ):
        raise ValueError(f"{label} values must be between 0 and 255.")


def _run_set_text_style(client: AEClient, args: argparse.Namespace) -> None:
    values = (
        args.font,
        args.font_size,
        args.fill_enabled,
        args.fill_color,
        args.stroke_enabled,
        args.stroke_color,
        args.stroke_width,
        args.stroke_over_fill,
        args.tracking,
        args.leading,
        args.auto_leading,
        args.justification,
    )
    if all(value is None for value in values):
        raise ValueError("Provide at least one text style option.")
    if args.font_size is not None and (
        not math.isfinite(args.font_size) or not 0.1 <= args.font_size <= 1296
    ):
        raise ValueError("--font-size must be between 0.1 and 1296.")
    _validate_text_color(args.fill_color, "--fill-color")
    _validate_text_color(args.stroke_color, "--stroke-color")
    if args.stroke_width is not None and (
        not math.isfinite(args.stroke_width) or not 0 <= args.stroke_width <= 1000
    ):
        raise ValueError("--stroke-width must be between 0 and 1000.")
    if args.tracking is not None and not math.isfinite(args.tracking):
        raise ValueError("--tracking must be a finite number.")
    if args.leading is not None and (
        not math.isfinite(args.leading) or not 0.1 <= args.leading <= 1296
    ):
        raise ValueError("--leading must be between 0.1 and 1296.")
    if args.leading is not None and args.auto_leading is True:
        raise ValueError("--leading cannot be combined with --auto-leading.")
    _print_json(
        client.set_text_style(
            font=args.font,
            fontSize=args.font_size,
            fillEnabled=args.fill_enabled,
            fillColor=args.fill_color,
            strokeEnabled=args.stroke_enabled,
            strokeColor=args.stroke_color,
            strokeWidth=args.stroke_width,
            strokeOverFill=args.stroke_over_fill,
            tracking=args.tracking,
            leading=args.leading,
            autoLeading=args.auto_leading,
            justification=args.justification,
            **_layer_selector_kwargs(args),
        )
    )


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


def _run_expression_errors(client: AEClient, _args: argparse.Namespace) -> None:
    _print_json(client.get_expression_errors())


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


def _run_add_essential_property(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(
        client.add_essential_property(
            property_path=args.property_path,
            essential_name=args.essential_name,
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


def _run_apply_scene(client: AEClient, args: argparse.Namespace) -> None:
    scene = _read_json_file(args.scene_file, "scene-file")
    _print_json(
        client.apply_scene(
            scene=scene,
            validate_only=args.validate_only,
            mode=args.mode,
        )
    )


CommandHandler = Callable[[AEClient, argparse.Namespace], None]

COMMAND_HANDLERS: dict[str, CommandHandler] = {
    "health": _run_health,
    "layers": _run_layers,
    "list-comps": _run_list_comps,
    "list-footage": _run_list_footage,
    "import-footage": _run_import_footage,
    "add-footage-layer": _run_add_footage_layer,
    "set-footage-cut": _run_set_footage_cut,
    "get-layer-audio": _run_get_layer_audio,
    "set-layer-audio": _run_set_layer_audio,
    "list-fonts": _run_list_fonts,
    "get-text-style": _run_get_text_style,
    "set-text-style": _run_set_text_style,
    "create-comp": _run_create_comp,
    "set-active-comp": _run_set_active_comp,
    "selected-properties": _run_selected_properties,
    "expression-errors": _run_expression_errors,
    "properties": _run_properties,
    "set-expression": _run_set_expression,
    "set-property": _run_set_property,
    "set-keyframe": _run_set_keyframe,
    "add-essential-property": _run_add_essential_property,
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
    "apply-scene": _run_apply_scene,
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

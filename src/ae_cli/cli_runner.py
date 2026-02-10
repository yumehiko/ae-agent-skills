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


def _run_health(client: AEClient, _args: argparse.Namespace) -> None:
    _print_json(client.health())


def _run_layers(client: AEClient, _args: argparse.Namespace) -> None:
    _print_json(client.get_layers())


def _run_selected_properties(client: AEClient, _args: argparse.Namespace) -> None:
    _print_json(client.get_selected_properties())


def _run_properties(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(
        client.get_properties(
            layer_id=args.layer_id,
            include_groups=args.include_group,
            exclude_groups=args.exclude_group,
            max_depth=args.max_depth,
        )
    )


def _run_set_expression(client: AEClient, args: argparse.Namespace) -> None:
    expression = _read_expression(args)
    _print_json(
        client.set_expression(
            layer_id=args.layer_id,
            property_path=args.property_path,
            expression=expression,
        )
    )


def _run_add_effect(client: AEClient, args: argparse.Namespace) -> None:
    _print_json(
        client.add_effect(
            layer_id=args.layer_id,
            effect_match_name=args.effect_match_name,
            effect_name=args.effect_name,
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
        )
    )


CommandHandler = Callable[[AEClient, argparse.Namespace], None]

COMMAND_HANDLERS: dict[str, CommandHandler] = {
    "health": _run_health,
    "layers": _run_layers,
    "selected-properties": _run_selected_properties,
    "properties": _run_properties,
    "set-expression": _run_set_expression,
    "add-effect": _run_add_effect,
    "add-layer": _run_add_layer,
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

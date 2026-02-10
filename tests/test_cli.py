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


def test_run_command_returns_2_for_unknown_command(capsys) -> None:
    args = SimpleNamespace(command="unknown", base_url="http://x", timeout=1.0)
    code = run_command(args)
    captured = capsys.readouterr()
    assert code == 2
    assert "Unknown command" in captured.err

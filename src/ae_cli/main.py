from __future__ import annotations

from .cli_parser import build_parser
from .cli_runner import run_command


def run(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return run_command(args)


if __name__ == "__main__":
    raise SystemExit(run())

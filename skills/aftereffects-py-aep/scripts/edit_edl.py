#!/usr/bin/env python3
"""Export or apply a strict EDL for simple file-backed cut layers."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any

import py_aep

from editorial import apply_edl, export_edl, find_comp, sha256_file


CSV_FIELDS = (
    "layerId",
    "name",
    "sourceName",
    "sourcePath",
    "recordInFrame",
    "recordOutFrame",
    "sourceIn",
    "sourceOut",
    "stretch",
    "position",
)


def write_document(document: dict[str, Any], output: Path, fmt: str) -> None:
    output = output.expanduser().resolve()
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "json":
        output.write_text(
            json.dumps(document, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        return
    with output.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in document["layers"]:
            selected = {key: row.get(key) for key in CSV_FIELDS}
            selected["position"] = json.dumps(selected["position"])
            writer.writerow(selected)


def command_export(args: argparse.Namespace) -> int:
    source = args.project.expanduser().resolve()
    app = py_aep.parse(source)
    comp = find_comp(app.project, comp_name=args.comp, comp_id=args.comp_id)
    document = export_edl(app, source, comp, sample_time=args.time)
    write_document(document, args.output, args.format)
    print(
        json.dumps(
            {
                "output": str(args.output.expanduser().resolve()),
                "comp": comp.name,
                "layers": len(document["layers"]),
                "unsupportedLayers": sum(bool(row["unsupported"]) for row in document["layers"]),
            },
            ensure_ascii=False,
        )
    )
    return 0


def command_apply(args: argparse.Namespace) -> int:
    source = args.project.expanduser().resolve()
    output = args.output.expanduser().resolve()
    if source == output or output.exists():
        raise FileExistsError("Use a new output .aep path")
    if output.suffix.lower() != ".aep":
        raise ValueError("Output must use the .aep extension")
    document = json.loads(args.edl.expanduser().resolve().read_text(encoding="utf-8"))
    if document["project"]["sha256"] != sha256_file(source):
        raise ValueError("Input AEP SHA-256 does not match the EDL")

    app = py_aep.parse(source)
    comp = apply_edl(app.project, document)
    app.project.save(output)
    if sha256_file(source) != document["project"]["sha256"]:
        raise AssertionError("Input AEP changed during EDL apply")

    checked = py_aep.parse(output).project
    checked_comp = find_comp(checked, comp_name=comp.name, comp_id=comp.id)
    checked_rows = {layer.id: layer for layer in checked_comp.layers}
    for row in document["layers"]:
        layer = checked_rows[int(row["layerId"])]
        assert layer.frame_in_point == int(row["recordInFrame"])
        assert layer.frame_out_point == int(row["recordOutFrame"])
        assert layer.name == row["name"]
        assert layer.source.id == row["sourceId"]
        assert abs(layer.stretch - float(row["stretch"])) < 1e-9
        factor = layer.stretch / 100.0
        checked_source_in = (layer.in_point - layer.start_time) / factor
        assert abs(checked_source_in - float(row["sourceIn"])) < 1e-7
        assert layer.transform["ADBE Position"].value == row["position"]
        assert layer.transform["ADBE Scale"].value == row["scale"]
        assert layer.transform["ADBE Opacity"].value == row["opacity"]
    print(
        json.dumps(
            {"output": str(output), "comp": checked_comp.name, "layers": len(checked_comp.layers)},
            ensure_ascii=False,
        )
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    export_parser = subparsers.add_parser("export")
    export_parser.add_argument("project", type=Path)
    selectors = export_parser.add_mutually_exclusive_group(required=True)
    selectors.add_argument("--comp")
    selectors.add_argument("--comp-id", type=int)
    export_parser.add_argument("--time", type=float, default=0.0)
    export_parser.add_argument("--format", choices=("json", "csv"), default="json")
    export_parser.add_argument("--output", type=Path, required=True)
    export_parser.set_defaults(func=command_export)

    apply_parser = subparsers.add_parser("apply")
    apply_parser.add_argument("project", type=Path)
    apply_parser.add_argument("--edl", type=Path, required=True)
    apply_parser.add_argument("--output", type=Path, required=True)
    apply_parser.set_defaults(func=command_apply)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())

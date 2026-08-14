#!/usr/bin/env python3
"""Render a strict offline editorial proxy from ae-agent-edl/v1 JSON."""

from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
from pathlib import Path
from typing import Any

from editorial import validate_edl, visible_source_rect


DEFAULT_SAMPLES = (0.08, 0.35, 0.50, 0.65, 0.92)


def require_ffmpeg() -> str:
    executable = shutil.which("ffmpeg")
    if executable is None:
        raise RuntimeError("ffmpeg is required for editorial proxy rendering")
    return executable


def crop_geometry(
    row: dict[str, Any],
    comp: dict[str, Any],
    *,
    viewport_width: int,
    viewport_height: int,
) -> tuple[int, int, int, int]:
    left, top, width, height = visible_source_rect(
        row,
        comp,
        viewport_width=viewport_width,
        viewport_height=viewport_height,
    )
    values = tuple(int(round(value)) for value in (left, top, width, height))
    x, y, crop_width, crop_height = values
    source_width = int(row["sourceWidth"])
    source_height = int(row["sourceHeight"])
    if x < 0 or y < 0 or x + crop_width > source_width or y + crop_height > source_height:
        raise ValueError(
            f"Layer {row['name']!r} viewport falls outside the source: {values} "
            f"vs {source_width}x{source_height}"
        )
    if crop_width <= 0 or crop_height <= 0:
        raise ValueError("Computed crop has no area")
    return values


def record_duration(row: dict[str, Any], frame_rate: float) -> float:
    return (
        int(row["recordOutFrame"]) - int(row["recordInFrame"])
    ) / frame_rate


def source_time(row: dict[str, Any], fraction: float, frame_rate: float) -> float:
    output_duration = record_duration(row, frame_rate)
    return float(row["sourceIn"]) + fraction * output_duration / (
        float(row["stretch"]) / 100.0
    )


def run(command: list[str]) -> None:
    subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def render_samples(
    ffmpeg: str,
    document: dict[str, Any],
    output: Path,
    *,
    viewport_width: int,
    viewport_height: int,
    fractions: tuple[float, ...],
) -> list[dict[str, Any]]:
    manifest: list[dict[str, Any]] = []
    for row in sorted(document["layers"], key=lambda value: value["recordInFrame"]):
        layer_dir = output / f"layer-{int(row['index']):03d}-{int(row['layerId'])}"
        layer_dir.mkdir()
        x, y, width, height = crop_geometry(
            row,
            document["comp"],
            viewport_width=viewport_width,
            viewport_height=viewport_height,
        )
        samples: list[dict[str, Any]] = []
        for index, fraction in enumerate(fractions):
            time = source_time(row, fraction, float(document["comp"]["frameRate"]))
            target = layer_dir / f"sample-{index:02d}.png"
            run(
                [
                    ffmpeg,
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-ss",
                    f"{time:.9f}",
                    "-i",
                    str(row["sourcePath"]),
                    "-frames:v",
                    "1",
                    "-vf",
                    f"crop={width}:{height}:{x}:{y},scale={viewport_width}:{viewport_height}",
                    "-y",
                    str(target),
                ]
            )
            samples.append(
                {"fraction": fraction, "sourceTime": time, "file": str(target)}
            )
        sheet = layer_dir / "contact-sheet.png"
        columns = len(fractions)
        run(
            [
                ffmpeg,
                "-hide_banner",
                "-loglevel",
                "error",
                "-framerate",
                "1",
                "-start_number",
                "0",
                "-i",
                str(layer_dir / "sample-%02d.png"),
                "-frames:v",
                "1",
                "-vf",
                f"tile={columns}x1",
                "-y",
                str(sheet),
            ]
        )
        manifest.append(
            {
                "layerId": row["layerId"],
                "name": row["name"],
                "crop": [x, y, width, height],
                "contactSheet": str(sheet),
                "samples": samples,
            }
        )
    return manifest


def assert_contiguous(document: dict[str, Any]) -> list[dict[str, Any]]:
    rows = sorted(document["layers"], key=lambda value: value["recordInFrame"])
    if not rows:
        raise ValueError("EDL has no layers")
    for previous, current in zip(rows, rows[1:]):
        if int(previous["recordOutFrame"]) != int(current["recordInFrame"]):
            raise ValueError("Proxy MP4 requires a contiguous, non-overlapping EDL")
    return rows


def render_proxy_video(
    ffmpeg: str,
    document: dict[str, Any],
    output: Path,
    *,
    viewport_width: int,
    viewport_height: int,
) -> Path:
    rows = assert_contiguous(document)
    command = [ffmpeg, "-hide_banner", "-loglevel", "error"]
    filters: list[str] = []
    for index, row in enumerate(rows):
        stretch_factor = float(row["stretch"]) / 100.0
        output_duration = record_duration(
            row, float(document["comp"]["frameRate"])
        )
        input_duration = output_duration / stretch_factor
        command.extend(
            [
                "-ss",
                f"{float(row['sourceIn']):.9f}",
                "-t",
                f"{input_duration:.9f}",
                "-i",
                str(row["sourcePath"]),
            ]
        )
        x, y, width, height = crop_geometry(
            row,
            document["comp"],
            viewport_width=viewport_width,
            viewport_height=viewport_height,
        )
        filters.append(
            f"[{index}:v]trim=duration={input_duration:.9f},"
            f"setpts={stretch_factor:.9f}*(PTS-STARTPTS),"
            f"crop={width}:{height}:{x}:{y},"
            f"scale={viewport_width}:{viewport_height},"
            f"fps={float(document['comp']['frameRate']):.9f},format=yuv420p[v{index}]"
        )
    inputs = "".join(f"[v{index}]" for index in range(len(rows)))
    filters.append(f"{inputs}concat=n={len(rows)}:v=1:a=0[outv]")
    target = output / "editorial-proxy.mp4"
    command.extend(
        [
            "-filter_complex",
            ";".join(filters),
            "-map",
            "[outv]",
            "-an",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-y",
            str(target),
        ]
    )
    run(command)
    return target


def parse_fractions(value: str) -> tuple[float, ...]:
    fractions = tuple(float(part) for part in value.split(","))
    if not fractions or any(not math.isfinite(value) or value < 0 or value > 1 for value in fractions):
        raise argparse.ArgumentTypeError("samples must be comma-separated values from 0 to 1")
    return fractions


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("edl", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--viewport-width", type=int)
    parser.add_argument("--viewport-height", type=int)
    parser.add_argument("--samples", type=parse_fractions, default=DEFAULT_SAMPLES)
    args = parser.parse_args()

    edl_path = args.edl.expanduser().resolve()
    output = args.output.expanduser().resolve()
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite output directory: {output}")
    document = json.loads(edl_path.read_text(encoding="utf-8"))
    validate_edl(document)
    for row in document["layers"]:
        source = Path(row["sourcePath"])
        if not source.is_file():
            raise FileNotFoundError(f"Missing source: {source}")
    viewport_width = args.viewport_width or int(document["comp"]["width"])
    viewport_height = args.viewport_height or int(document["comp"]["height"])
    output.mkdir(parents=True)

    ffmpeg = require_ffmpeg()
    layers = render_samples(
        ffmpeg,
        document,
        output,
        viewport_width=viewport_width,
        viewport_height=viewport_height,
        fractions=args.samples,
    )
    proxy = render_proxy_video(
        ffmpeg,
        document,
        output,
        viewport_width=viewport_width,
        viewport_height=viewport_height,
    )
    manifest = {
        "validation": "offline-editorial-proxy",
        "edl": str(edl_path),
        "viewport": [viewport_width, viewport_height],
        "proxy": str(proxy),
        "layers": layers,
    }
    manifest_path = output / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"output": str(output), "layers": len(layers), "proxy": str(proxy)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Generate repeatable ae-cli scene JSON files from a tiny telop DSL.

Usage:
    python examples/gen_telop.py --out-dir /path/to/project/_edl/telops
    target_aep=/path/to/project/main.aep
    for scene in /path/to/project/_edl/telops/*.scene.json; do
      ae-cli apply-scene --scene-file "$scene" --expect-project "$target_aep" --validate-only
    done
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


# This is the higher-level DSL: production data stays short and contains no
# After Effects match names or property paths.
TELOPS = [
    {"slug": "speed", "text": "編集速度を2倍に", "accent": "2倍", "y": 1370},
    {"slug": "review", "text": "確認は3ステップ", "accent": "3ステップ", "y": 1370},
    {"slug": "finish", "text": "最後まで自動化", "accent": "自動化", "y": 1370},
]


def accent_range(text: str, accent: str) -> dict[str, Any]:
    start = text.index(accent)
    return {
        "start": start,
        "end": start + len(accent),
        "style": {"fontSize": 112, "fillColor": [255, 210, 48], "tracking": 10},
    }


def build_scene(item: dict[str, Any], index: int, font: str) -> dict[str, Any]:
    layer_id = "telop"
    return {
        "composition": {
            "name": f"Telop_{index:03d}_{item['slug']}",
            "width": 1080,
            "height": 1920,
            "duration": 1.8,
            "frameRate": 30,
            "pixelAspect": 1,
            "createIfMissing": True,
            "setActive": False,
        },
        "layers": [
            {
                "id": layer_id,
                "type": "text",
                "name": f"Telop {index:03d}",
                "text": item["text"],
                "textStyle": {
                    "font": font,
                    "fontSize": 92,
                    "fillColor": [255, 255, 255],
                    "strokeEnabled": True,
                    "strokeColor": [16, 20, 28],
                    "strokeWidth": 8,
                    "justification": "center",
                },
                "textStyleRanges": [accent_range(item["text"], item["accent"])],
                "textAnimators": [
                    {
                        "id": "reveal-up",
                        "properties": {
                            "position": [0, 72],
                            "scale": [88, 88],
                            "opacity": 0,
                            "rotation": -4,
                        },
                        "selector": {
                            "start": 0,
                            "end": 100,
                            "animations": [
                                {
                                    "property": "start",
                                    "keyframes": [
                                        {"time": 0, "value": 0, "outInterp": "bezier"},
                                        {
                                            "time": 0.55,
                                            "value": 100,
                                            "inInterp": "bezier",
                                            "easeIn": [0, 70],
                                        },
                                    ],
                                }
                            ],
                        },
                    }
                ],
                "transform": {"position": [540, item["y"]]},
            }
        ],
        "layout": [
            {"type": "visual-center", "layerIds": [layer_id], "time": 0.8},
            {
                "type": "align",
                "layerIds": [layer_id],
                "reference": "title-safe",
                "horizontal": "center",
                "offset": [0, 0],
                "time": 0.8,
            },
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument(
        "--font",
        default="HiraginoSans-W6",
        help="Installed Japanese-capable PostScript font name (default: HiraginoSans-W6)",
    )
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)

    for index, item in enumerate(TELOPS, start=1):
        output = args.out_dir / f"{index:03d}-{item['slug']}.scene.json"
        output.write_text(
            json.dumps(build_scene(item, index, args.font), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(output)


if __name__ == "__main__":
    main()

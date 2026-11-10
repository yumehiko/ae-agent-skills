"""Validated PNG-sequence import into the caller's existing py-aep object graph."""
from __future__ import annotations

from fractions import Fraction
import json
import math
from pathlib import Path
import struct

from .renderer import Scene, local_path, sha256


def validate_render(render_json):
    path = Path(render_json).expanduser().resolve(strict=True)
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or type(data.get("version")) is not int or data.get("version") != 1 or data.get("source") != "source":
        raise ValueError("Unsupported render manifest")
    for directory in (path.parent / "source", path.parent / "frames"):
        if directory.is_symlink() or not directory.is_dir():
            raise ValueError("Source and frames must be ordinary directories, not symlinks")
        if any(p.is_symlink() or not (p.is_dir() or p.is_file()) for p in directory.rglob("*")):
            raise ValueError("Render archive cannot contain symlinks or special files")
    scene = Scene.load(path.parent / "source")
    if scene.metadata() != data.get("scene") or data.get("duration") != str(Fraction(scene.frames) / scene.fps):
        raise ValueError("Scene metadata changed since rendering")
    if not isinstance(data.get("sourceHashes"), dict) or not data["sourceHashes"]:
        raise ValueError("Missing source hashes")
    actual_sources = {p.relative_to(scene.root).as_posix(): sha256(p) for p in scene.root.rglob("*") if p.is_file()}
    if actual_sources != data["sourceHashes"]:
        raise ValueError("Source files changed since rendering; render to a new output")
    frames = data.get("frames", [])
    if not isinstance(frames, list) or len(frames) != scene.frames or any(not isinstance(f, dict) or not isinstance(f.get("sha256"), str) for f in frames):
        raise ValueError("Frame count mismatch")
    expected = [f"frames/frame_{i:06d}.png" for i in range(scene.frames)]
    if [entry.get("file") for entry in frames] != expected:
        raise ValueError("Frames must be a contiguous zero-based PNG sequence")
    if sorted(p.name for p in (path.parent / "frames").iterdir()) != [Path(p).name for p in expected]:
        raise ValueError("Unexpected or missing files in sequence directory")
    for entry in frames:
        frame = local_path(path.parent, entry["file"])
        if not frame.is_file() or sha256(frame) != entry["sha256"]:
            raise ValueError(f"Missing or changed frame: {entry['file']}")
        header = frame.read_bytes()[:29]
        if len(header) != 29 or header[:8] != b"\x89PNG\r\n\x1a\n" or struct.unpack(">II", header[16:24]) != (scene.width, scene.height):
            raise ValueError(f"Invalid PNG dimensions: {frame}")
    return path, data, scene


def import_render(project, render_json, *, comp=None, name="Generative"):
    """Return (footage, layer-or-None). Caller owns parse/save/reparse and layer edits."""
    from py_aep import AlphaMode, ImportOptions

    path, data, scene = validate_render(render_json)
    options = ImportOptions(path.parent / data["frames"][0]["file"])
    options.sequence = True
    footage = project.import_file(options)
    footage.name = name
    footage.main_source.conform_frame_rate = float(scene.fps)
    if scene.alpha:
        footage.main_source.alpha_mode = AlphaMode.STRAIGHT
    footage.comment = "Code-authored raster sequence. Source and render manifest: " + str(path)
    layer = comp.add(footage) if comp is not None else None
    if layer is not None:
        layer.name = name
    return footage, layer


def create_project(render_json, output, *, ae_version, name="Generative"):
    """Build a new AEP once, then reparse and assert the sequence/timing/layer structure."""
    import py_aep

    path, _, scene = validate_render(render_json)
    output = Path(output).expanduser().resolve()
    if output.suffix.lower() != ".aep":
        raise ValueError("Output must use the .aep extension")
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite: {output}")
    app = py_aep.new(version=ae_version)
    duration = float(Fraction(scene.frames) / scene.fps)
    comp = app.project.root_folder.add_comp(name, scene.width, scene.height, 1, duration, float(scene.fps))
    # AE stores sequence/grid timing at thousandth-fps precision. Preserve the
    # declared frame count, rather than rounding a long rational duration twice.
    comp.frame_duration = scene.frames
    footage, layer = import_render(app.project, path, comp=comp, name=name)
    app.project.save(output)
    check = py_aep.parse(output).project
    checked = list(check.compositions)[0]
    assert len(check.compositions) == 1 and len(checked.layers) == 1
    assert (checked.width, checked.height) == (scene.width, scene.height)
    assert math.isclose(checked.frame_rate, float(scene.fps), abs_tol=0.001)
    assert checked.frame_duration == scene.frames
    source = checked.layers[0].source
    assert source.name == name and not source.main_source.is_still
    assert math.isclose(source.frame_rate, float(scene.fps), abs_tol=0.001)
    native_duration = scene.frames / round(float(scene.fps), 3)
    assert math.isclose(source.duration, native_duration, abs_tol=0.001)
    assert Path(source.main_source.file).resolve() == (path.parent / "frames/frame_000000.png").resolve()
    if scene.alpha:
        assert source.main_source.alpha_mode == py_aep.AlphaMode.STRAIGHT
    return output

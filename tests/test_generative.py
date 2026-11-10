"""Core tests need no browser. Opt in with AE_GENERATIVE_BROWSER_TESTS=1."""
from __future__ import annotations

from contextlib import contextmanager
from fractions import Fraction
import json
import os
from pathlib import Path
import shutil
import struct
import sys
import time
from types import SimpleNamespace
import zlib

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills/aftereffects-py-aep/scripts"))
from ae_generative import aep, renderer


def png(width=16, height=16):
    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress((b"\0" + b"\xff\0\0\x80" * width) * height)) + chunk(b"IEND", b""))


@pytest.fixture
def scene_dir(tmp_path):
    root = tmp_path / "scene"
    root.mkdir()
    (root / "scene.json").write_text(json.dumps(dict(version=1, entry="index.html", width=16,
        height=16, fps="30000/1001", frames=3, seed=17, alpha=True)))
    (root / "index.html").write_text("<canvas width=16 height=16></canvas><script>window.renderFrame = () => {};</script>")
    return root


def update_scene(root, **changes):
    path = root / "scene.json"
    data = json.loads(path.read_text())
    data.update(changes)
    path.write_text(json.dumps(data))


def test_rational_fps_is_exact(scene_dir):
    scene = renderer.Scene.load(scene_dir)
    assert scene.fps == Fraction(30000, 1001)
    assert Fraction(scene.frames) / scene.fps == Fraction(1001, 10000)
    assert scene.metadata()["fps"] == "30000/1001"


def test_capture_passes_explicit_frame_time_and_rejects_bad_indices(scene_dir, tmp_path):
    browser = object.__new__(renderer.FrameRenderer)
    browser.scene = renderer.Scene.load(scene_dir)
    browser.timeout = 3
    browser.errors = []
    calls = []
    browser._evaluate = lambda script, context, timeout: calls.append(context)
    browser.page = SimpleNamespace(screenshot=lambda **kwargs: calls.append(kwargs))
    browser.capture(2, tmp_path / "frame.png")
    assert calls[0]["time"] == float(Fraction(2 * 1001, 30000))
    assert calls[0]["deltaTime"] == float(Fraction(1001, 30000))
    assert calls[0]["seed"] == 17
    assert calls[1]["omit_background"] is True
    for invalid in (-1, 3, True, 1.5):
        with pytest.raises(ValueError, match="range"):
            browser.capture(invalid, tmp_path / "frame.png")


@pytest.mark.parametrize("field,value", [
    ("version", True), ("version", 2), ("width", True), ("width", 0), ("width", 8193),
    ("width", 1), ("width", 3), ("height", 1), ("height", 3),
    ("height", 1.5), ("frames", 0), ("frames", 1000001), ("seed", -1),
    ("seed", 2**32), ("seed", True), ("alpha", 1), ("fps", True), ("fps", "NaN"),
    ("fps", "1/0"), ("fps", "0"), ("fps", 100), ("entry", "../outside.html"),
    ("entry", "/index.html"), ("entry", "missing.html"), ("entry", "scene.json"),
])
def test_invalid_scene_values(scene_dir, field, value):
    update_scene(scene_dir, **{field: value})
    with pytest.raises(ValueError):
        renderer.Scene.load(scene_dir)


@pytest.mark.parametrize("dimension", [4, 8192])
def test_scene_dimension_boundaries(scene_dir, dimension):
    update_scene(scene_dir, width=dimension, height=dimension)
    scene = renderer.Scene.load(scene_dir)
    assert scene.width == scene.height == dimension


@pytest.mark.parametrize("data", [[], None, {}, {"version": 1}])
def test_invalid_manifest_shape(scene_dir, data):
    (scene_dir / "scene.json").write_text(json.dumps(data))
    with pytest.raises(ValueError):
        renderer.Scene.load(scene_dir)


def test_unknown_manifest_fields_rejected(scene_dir):
    update_scene(scene_dir, typo=True)
    with pytest.raises(ValueError):
        renderer.Scene.load(scene_dir)


def test_archive_copies_nested_assets_and_rejects_symlinks(scene_dir, tmp_path):
    (scene_dir / "assets").mkdir()
    asset = scene_dir / "assets/icon.png"
    asset.write_bytes(png())
    destination = tmp_path / "archive"
    hashes = renderer.archive_source(renderer.Scene.load(scene_dir), destination)
    assert (destination / "assets/icon.png").read_bytes() == png()
    assert hashes["assets/icon.png"] == renderer.sha256(asset)
    (scene_dir / "linked.png").symlink_to(asset)
    with pytest.raises(ValueError, match="ordinary files"):
        renderer.archive_source(renderer.Scene.load(scene_dir), tmp_path / "rejected")


@pytest.fixture
def fake_browser(monkeypatch):
    """Exercise filesystem orchestration without starting or installing Chromium."""
    @contextmanager
    def runtime():
        yield object()
    @contextmanager
    def server(root):
        yield "http://127.0.0.1:12345"
    class FakeRenderer:
        def __init__(self, *args, **kwargs):
            self.browser = SimpleNamespace(version="test")
        def capture(self, frame, output):
            output.write_bytes(png())
        def close(self):
            pass
    monkeypatch.setitem(sys.modules, "playwright.sync_api", SimpleNamespace(sync_playwright=runtime))
    monkeypatch.setattr(renderer, "serve_scene", server)
    monkeypatch.setattr(renderer, "FrameRenderer", FakeRenderer)
    monkeypatch.setattr(renderer.importlib.metadata, "version", lambda name: "test")
    return FakeRenderer


@pytest.fixture
def rendered(scene_dir, tmp_path, fake_browser):
    return renderer.render_scene(scene_dir, tmp_path / "render")


def test_render_archive_and_manifest(rendered):
    _, data, scene = aep.validate_render(rendered)
    assert data["duration"] == "1001/10000"
    assert len(data["frames"]) == scene.frames == 3
    assert data["renderer"]["alphaMode"] == "straight"
    assert data["sourceHashes"]["index.html"]


def test_no_overwrite_or_output_inside_source(scene_dir, tmp_path, fake_browser):
    existing = tmp_path / "existing"
    existing.mkdir()
    marker = existing / "keep.txt"
    marker.write_text("preserve")
    with pytest.raises(FileExistsError):
        renderer.render_scene(scene_dir, existing)
    assert marker.read_text() == "preserve"
    with pytest.raises(ValueError, match="outside"):
        renderer.render_scene(scene_dir, scene_dir / "render")


@pytest.mark.parametrize("timeout", [0, -1, 3601, float("nan"), "30", True])
def test_invalid_timeout(scene_dir, tmp_path, fake_browser, timeout):
    with pytest.raises(ValueError, match="timeout"):
        renderer.render_scene(scene_dir, tmp_path / "render", timeout=timeout)


def test_failed_run_has_no_success_manifest(scene_dir, tmp_path, fake_browser, monkeypatch):
    def fail(self, frame, output):
        raise RuntimeError("broken frame")
    monkeypatch.setattr(fake_browser, "capture", fail)
    with pytest.raises(RuntimeError, match="broken frame"):
        renderer.render_scene(scene_dir, tmp_path / "failed")
    assert not (tmp_path / "failed/render.json").exists()


@pytest.mark.parametrize("tamper", ["source", "frame", "extra", "missing", "traversal", "metadata", "dimensions"])
def test_integrity_tampering_rejected(rendered, tamper):
    data = json.loads(rendered.read_text())
    frame = rendered.parent / "frames/frame_000000.png"
    if tamper == "source":
        (rendered.parent / "source/index.html").write_text("changed")
    elif tamper == "frame":
        frame.write_bytes(b"changed")
    elif tamper == "extra":
        (frame.parent / "extra.png").write_bytes(png())
    elif tamper == "missing":
        frame.unlink()
    elif tamper == "traversal":
        data["frames"][0]["file"] = "../outside.png"
    elif tamper == "metadata":
        data["scene"]["seed"] += 1
    else:
        frame.write_bytes(png(8, 8))
        data["frames"][0]["sha256"] = renderer.sha256(frame)
    rendered.write_text(json.dumps(data))
    with pytest.raises(ValueError):
        aep.validate_render(rendered)


@pytest.mark.parametrize("shape", [None, [], "invalid", 1])
def test_render_manifest_must_be_object(rendered, shape):
    rendered.write_text(json.dumps(shape))
    with pytest.raises(ValueError):
        aep.validate_render(rendered)


@pytest.mark.parametrize("frames", [None, {}, "invalid", [None, None, None], [1, 2, 3], [[], [], []]])
def test_render_manifest_frames_must_be_object_list(rendered, frames):
    data = json.loads(rendered.read_text())
    data["frames"] = frames
    rendered.write_text(json.dumps(data))
    with pytest.raises(ValueError):
        aep.validate_render(rendered)


@pytest.mark.parametrize("target", ["source_root", "source_asset", "frame"])
def test_hash_identical_symlink_replacement_rejected(rendered, tmp_path, target):
    if target == "source_root":
        original = rendered.parent / "source"
        replacement = tmp_path / "relocated-source"
    elif target == "source_asset":
        # A non-entry asset demonstrates that entry-path checks alone do not suffice.
        original = rendered.parent / "source/asset.png"
        original.write_bytes(png())
        data = json.loads(rendered.read_text())
        data["sourceHashes"]["asset.png"] = renderer.sha256(original)
        rendered.write_text(json.dumps(data))
        replacement = tmp_path / "relocated-asset.png"
    else:
        original = rendered.parent / "frames/frame_000000.png"
        # Keep the target inside the bundle so local_path cannot reject it alone.
        replacement = rendered.parent / "relocated-frame.png"
    original.rename(replacement)
    original.symlink_to(replacement, target_is_directory=target == "source_root")
    with pytest.raises(ValueError):
        aep.validate_render(rendered)


def test_import_and_create_project_roundtrip(rendered, tmp_path):
    import py_aep
    app = py_aep.new(version="25.6x101")
    footage, layer = aep.import_render(app.project, rendered, name="Icons")
    assert layer is None
    assert not footage.main_source.is_still
    assert footage.frame_rate == pytest.approx(30000 / 1001, abs=.001)
    output = aep.create_project(rendered, tmp_path / "icons.aep", ae_version="25.6x101", name="Icons")
    comp = list(py_aep.parse(output).project.compositions)[0]
    assert comp.layers[0].name == "Icons"
    assert comp.layers[0].source.main_source.alpha_mode == py_aep.AlphaMode.STRAIGHT
    with pytest.raises(FileExistsError):
        aep.create_project(rendered, output, ae_version="25.6x101")


browser_test = pytest.mark.skipif(os.environ.get("AE_GENERATIVE_BROWSER_TESTS") != "1",
    reason="Set AE_GENERATIVE_BROWSER_TESTS=1 to exercise installed Chromium")


def rgba_pixels(path):
    """Decode 8-bit RGB/RGBA Chromium PNGs without adding Pillow as a dependency."""
    data = path.read_bytes()
    width, height, depth, color = struct.unpack(">IIBB", data[16:26])
    assert depth == 8 and color in (2, 6)
    channels = 4 if color == 6 else 3
    packed, cursor = b"", 8
    while cursor < len(data):
        length = struct.unpack(">I", data[cursor:cursor+4])[0]
        if data[cursor+4:cursor+8] == b"IDAT":
            packed += data[cursor+8:cursor+8+length]
        cursor += length + 12
    raw, previous, rows = zlib.decompress(packed), [0] * (width * channels), []
    stride = width * channels
    for y in range(height):
        mode = raw[y * (stride + 1)]
        row = list(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for x in range(stride):
            left = row[x-channels] if x >= channels else 0
            up = previous[x]
            ul = previous[x-channels] if x >= channels else 0
            prediction = left + up - ul
            paeth = min((left, up, ul), key=lambda v: abs(prediction-v))
            row[x] = (row[x] + (0, left, up, (left+up)//2, paeth)[mode]) % 256
        rows.extend(tuple(row[x:x+channels]) + (() if channels == 4 else (255,)) for x in range(0, stride, channels))
        previous = row
    return rows


@browser_test
def test_browser_repeat_seek_seed_and_alpha(scene_dir, tmp_path):
    from playwright.sync_api import sync_playwright
    (scene_dir / "index.html").write_text("""<style>body{margin:0}</style><canvas width=16 height=16></canvas><script>
    window.renderFrame = c => { const x=document.querySelector('canvas').getContext('2d');
      x.clearRect(0,0,16,16); x.fillStyle=`rgb(${Math.floor(c.random()*256)},${c.frame*80},0)`;
      x.fillRect(0,0,8,8); };</script>""")
    first = renderer.render_scene(scene_dir, tmp_path / "first")
    second = renderer.render_scene(scene_dir, tmp_path / "second")
    assert json.loads(first.read_text())["frames"] == json.loads(second.read_text())["frames"]
    pixels = rgba_pixels(first.parent / "frames/frame_000000.png")
    assert pixels[0][3] == 255 and pixels[-1][3] == 0
    with renderer.serve_scene(scene_dir) as origin, sync_playwright() as p:
        browser = renderer.FrameRenderer(p, renderer.Scene.load(scene_dir), origin)
        try:
            for frame in (2, 0, 1, 2):
                path = tmp_path / "seek.png"
                browser.capture(frame, path)
                assert path.read_bytes() == (first.parent / f"frames/frame_{frame:06d}.png").read_bytes()
        finally:
            browser.close()
    update_scene(scene_dir, seed=123)
    changed = renderer.render_scene(scene_dir, tmp_path / "changed")
    assert json.loads(changed.read_text())["frames"] != json.loads(first.read_text())["frames"]


@browser_test
def test_browser_waits_for_local_asset_readiness(scene_dir, tmp_path):
    (scene_dir / "icon.png").write_bytes(png())
    (scene_dir / "index.html").write_text("""<style>body{margin:0}</style><script>
      window.sceneReady = new Promise(resolve => setTimeout(() => {
        const image = new Image(); image.src='icon.png'; document.body.append(image); resolve();
      }, 40)); window.renderFrame = () => {};</script>""")
    result = renderer.render_scene(scene_dir, tmp_path / "ready")
    assert (result.parent / "source/icon.png").read_bytes() == png()
    assert rgba_pixels(result.parent / "frames/frame_000000.png")[0][3] == 128


@browser_test
def test_bundled_example_renders_and_opaque_mode(tmp_path):
    root = tmp_path / "example"
    shutil.copytree(ROOT / "skills/aftereffects-py-aep/assets/generative/floating-icons", root)
    update_scene(root, width=64, height=64, frames=2, alpha=False)
    result = renderer.render_scene(root, tmp_path / "example-render")
    _, data, _ = aep.validate_render(result)
    assert "star.svg" in data["sourceHashes"]
    assert data["renderer"]["alphaMode"] == "opaque"
    assert all(pixel[3] == 255 for pixel in rgba_pixels(result.parent / "frames/frame_000000.png"))


@browser_test
@pytest.mark.parametrize("body", [
    "<img src='missing.png'><script>window.renderFrame=()=>{};</script>",
    "<img src='https://example.com/blocked.png'><script>window.renderFrame=()=>{};</script>",
    "<script>window.sceneReady=new Promise(()=>{});window.renderFrame=()=>{};</script>",
    "<script>window.renderFrame=()=>new Promise(()=>{});</script>",
])
def test_browser_failures_never_publish_success(scene_dir, tmp_path, body):
    (scene_dir / "index.html").write_text(body)
    with pytest.raises(Exception):
        renderer.render_scene(scene_dir, tmp_path / "failed", timeout=.3)
    assert not (tmp_path / "failed/render.json").exists()


@browser_test
def test_browser_synchronous_busy_loop_times_out(scene_dir, tmp_path):
    from playwright.sync_api import sync_playwright
    # Finite loop keeps a timeout regression from hanging the entire test runner.
    (scene_dir / "index.html").write_text("""<script>
      window.renderFrame = () => { const start = Date.now();
        while (Date.now() - start < 5000) {} };
    </script>""")
    with renderer.serve_scene(scene_dir) as origin, sync_playwright() as p:
        browser = renderer.FrameRenderer(p, renderer.Scene.load(scene_dir), origin, timeout=.3)
        try:
            started = time.monotonic()
            # Chromium may report its execution termination as CDP "Internal error".
            with pytest.raises(Exception):
                browser.capture(0, tmp_path / "busy.png")
            assert time.monotonic() - started < 4
            assert not (tmp_path / "busy.png").exists()
        finally:
            browser.close()


def test_duration_must_fit_ae_composition(scene_dir):
    update_scene(scene_dir, fps=1, frames=10801)
    with pytest.raises(ValueError, match="duration"):
        renderer.Scene.load(scene_dir)
    update_scene(scene_dir, frames=10800)
    assert renderer.Scene.load(scene_dir).frames == 10800


def test_project_preserves_frame_count_at_fractional_rate(rendered, tmp_path):
    import py_aep
    output = aep.create_project(rendered, tmp_path / "frame-count.aep", ae_version="26.3x87")
    comp = list(py_aep.parse(output).project.compositions)[0]
    assert comp.frame_duration == 3
    assert abs(comp.layers[0].source.duration - 3 / 29.97) < 0.000001


def test_missing_managed_browser_never_falls_back_to_system_chrome(scene_dir):
    launches = []
    def launch(**options):
        launches.append(options)
        raise RuntimeError("Managed Chromium missing")
    runtime = SimpleNamespace(chromium=SimpleNamespace(executable_path="/missing/chromium", launch=launch))
    with pytest.raises(RuntimeError, match="ae-generative setup.*Managed Chromium missing"):
        renderer.FrameRenderer(runtime, renderer.Scene.load(scene_dir), "http://127.0.0.1:1234")
    assert launches == [{"headless": True}]


def test_explicit_browser_override_is_respected(scene_dir, tmp_path):
    launches = []
    executable = tmp_path / "custom-chromium"
    executable.touch()
    def launch(**options):
        launches.append(options)
        raise RuntimeError("Test launch")
    runtime = SimpleNamespace(chromium=SimpleNamespace(launch=launch))
    with pytest.raises(RuntimeError, match="Chromium could not start"):
        renderer.FrameRenderer(runtime, renderer.Scene.load(scene_dir), "http://127.0.0.1:1234", executable_path=executable)
    assert launches == [{"headless": True, "executable_path": str(executable)}]


def test_setup_failure_has_actionable_cli_error(monkeypatch, capsys):
    from ae_generative import cli
    def fail(command, **kwargs):
        raise cli.subprocess.CalledProcessError(1, command)
    monkeypatch.setattr(cli.subprocess, "run", fail)
    with pytest.raises(SystemExit) as error:
        cli.run(["setup"])
    assert error.value.code == 1
    message = capsys.readouterr().err
    assert "ae-generative:" in message
    assert "network or installation error" in message and "rerun ae-generative setup" in message


@browser_test
def test_browser_webgl_at_fractional_frame_times(scene_dir, tmp_path):
    (scene_dir / "index.html").write_text("""<style>body{margin:0}</style><canvas width=16 height=16></canvas><script>
      const gl=document.querySelector('canvas').getContext('webgl', {preserveDrawingBuffer:true, alpha:true});
      if (!gl) throw new Error('WebGL unavailable');
      window.renderFrame = c => {
        if (Math.abs(c.time - c.frame*1001/30000)>1e-12) throw new Error('Wrong fractional time');
        gl.clearColor(c.frame/2,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT); gl.finish();
      };</script>""")
    result = renderer.render_scene(scene_dir, tmp_path / "webgl")
    aep.validate_render(result)
    assert rgba_pixels(result.parent / "frames/frame_000000.png")[0] == (0, 0, 0, 255)
    assert rgba_pixels(result.parent / "frames/frame_000002.png")[0] == (255, 0, 0, 255)


@pytest.mark.parametrize("error_name", ["Error", "TimeoutError"])
def test_cli_handles_public_browser_errors(monkeypatch, capsys, error_name):
    from ae_generative import cli
    from playwright import sync_api
    def fail(*args, **kwargs):
        raise getattr(sync_api, error_name)("Page.screenshot: synthetic browser failure")
    monkeypatch.setattr(cli, "render_scene", fail)
    with pytest.raises(SystemExit) as error:
        cli.run(["render", "scene", "--output", "output"])
    assert error.value.code == 1
    message = capsys.readouterr().err
    assert "synthetic browser failure" in message
    assert "No successful render.json" in message and "new --output" in message
    assert "Traceback" not in message


def test_cli_does_not_hide_programming_errors(monkeypatch):
    from ae_generative import cli
    def fail(*args, **kwargs):
        raise TypeError("programming bug")
    monkeypatch.setattr(cli, "render_scene", fail)
    with pytest.raises(TypeError, match="programming bug"):
        cli.run(["render", "scene", "--output", "output"])


@browser_test
@pytest.mark.parametrize("body", [
    "<img src='missing.png'><script>window.renderFrame=()=>{};</script>",
    "<script>window.renderFrame=()=>new Promise(()=>{});</script>",
])
def test_actual_cli_browser_failure_has_no_traceback(scene_dir, tmp_path, body):
    import subprocess
    (scene_dir / "index.html").write_text(body)
    output = tmp_path / "cli-failed"
    result = subprocess.run([sys.executable, str(ROOT / "skills/aftereffects-py-aep/scripts/render_generative.py"),
        "render", str(scene_dir), "--output", str(output), "--timeout", "0.3"], capture_output=True, text=True)
    assert result.returncode == 1
    assert "ae-generative:" in result.stderr and "Traceback" not in result.stderr
    assert "No successful render.json" in result.stderr and "new --output" in result.stderr
    assert not (output / "render.json").exists()


def test_cli_render_reports_missing_playwright_without_import_traceback(monkeypatch, capsys):
    import builtins
    from ae_generative import cli
    original = builtins.__import__
    def no_playwright(name, *args, **kwargs):
        if name == "playwright.sync_api":
            raise ImportError("Playwright unavailable")
        return original(name, *args, **kwargs)
    def fail(*args, **kwargs):
        raise RuntimeError("Install the core runtime first")
    monkeypatch.setattr(builtins, "__import__", no_playwright)
    monkeypatch.setattr(cli, "render_scene", fail)
    with pytest.raises(SystemExit) as error:
        cli.run(["render", "scene", "--output", "output"])
    assert error.value.code == 1
    assert "Install the core runtime first" in capsys.readouterr().err

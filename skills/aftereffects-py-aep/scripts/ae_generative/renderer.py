"""Render a trusted, local web scene at explicit frame times, never wall-clock speed."""
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from fractions import Fraction
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.metadata
import json
import mimetypes
from pathlib import Path
import shutil
import threading
from urllib.parse import quote, unquote, urlsplit


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def positive_int(value, name, maximum, minimum=1):
    if type(value) is not int or not minimum <= value <= maximum:
        raise ValueError(f"{name} must be an integer in {minimum}..{maximum}")
    return value


def local_path(root: Path, relative: str) -> Path:
    if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
        raise ValueError("Require a relative asset path")
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("Asset path escapes the scene directory")
    return path


@dataclass(frozen=True)
class Scene:
    root: Path
    entry: str
    width: int
    height: int
    fps: Fraction
    frames: int
    seed: int
    alpha: bool

    @classmethod
    def load(cls, directory):
        root = Path(directory).expanduser().resolve(strict=True)
        data = json.loads((root / "scene.json").read_text(encoding="utf-8"))
        required = {"version", "entry", "width", "height", "fps", "frames", "seed", "alpha"}
        if not isinstance(data, dict) or set(data) != required or type(data["version"]) is not int or data["version"] != 1:
            raise ValueError("scene.json requires exactly version=1, entry, width, height, fps, frames, seed, alpha")
        entry = local_path(root, data["entry"])
        if not entry.is_file() or entry.suffix.lower() not in (".html", ".htm"):
            raise ValueError("entry must be a local HTML file")
        if type(data["fps"]) not in (str, int, float):
            raise ValueError("fps must be a number or rational string, e.g. 30000/1001")
        try:
            fps = Fraction(str(data["fps"]))
        except (ValueError, ZeroDivisionError) as exc:
            raise ValueError("fps must be finite and positive") from exc
        if not Fraction(1, 1) <= fps <= 99:
            raise ValueError("fps must be in the supported range 1..99")
        frames = positive_int(data["frames"], "frames", 1000000)
        if Fraction(frames) / fps > 10800:
            raise ValueError("Scene duration cannot exceed AE's 10800-second limit")
        if type(data["seed"]) is not int or not 0 <= data["seed"] <= 0xFFFFFFFF:
            raise ValueError("seed must be an unsigned 32-bit integer")
        if type(data["alpha"]) is not bool:
            raise ValueError("alpha must be true or false")
        return cls(root, data["entry"], positive_int(data["width"], "width", 8192, 4),
                   positive_int(data["height"], "height", 8192, 4), fps,
                   frames, data["seed"], data["alpha"])

    def metadata(self):
        return dict(version=1, entry=self.entry, width=self.width, height=self.height,
                    fps=str(self.fps), frames=self.frames, seed=self.seed, alpha=self.alpha)


def archive_source(scene: Scene, destination: Path):
    """Snapshot local inputs; reject symlinks and special files instead of following them."""
    files = sorted(scene.root.rglob("*"))
    for path in files:
        if path.is_symlink() or not (path.is_dir() or path.is_file()):
            raise ValueError(f"Scene must contain ordinary files only: {path}")
    destination.mkdir()
    hashes = {}
    for path in files:
        relative = path.relative_to(scene.root)
        target = destination / relative
        if path.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)
            hashes[relative.as_posix()] = sha256(target)
    return hashes


@contextmanager
def serve_scene(root: Path):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            try:
                path = local_path(root, unquote(urlsplit(self.path).path).lstrip("/"))
                if not path.is_file():
                    self.send_error(404)
                    return
                content = path.read_bytes()
            except (ValueError, OSError):
                self.send_error(403)
                return
            self.send_response(200)
            self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "application/octet-stream")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            # External requests are also rejected at the browser context boundary.
            self.send_header("Content-Security-Policy", "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-src 'none'; worker-src 'none'")
            self.end_headers()
            self.wfile.write(content)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        worker.join()


INIT_SCRIPT = r"""
(() => {
  let state = SEED;
  window.__aeSeed = (seed) => { state = seed >>> 0; };
  Math.random = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  window.__aeViolations = [];
  document.addEventListener('securitypolicyviolation', e => {
    window.__aeViolations.push(e.violatedDirective + ': ' + e.blockedURI);
  });
  window.requestAnimationFrame = () => {
    throw new Error('Use window.renderFrame(context), not requestAnimationFrame');
  };
})();
"""

READY_SCRIPT = r"""async () => {
  await window.sceneReady;
  await document.fonts.ready;
  if (typeof window.renderFrame !== 'function') throw new Error('Define window.renderFrame(context)');
}"""

RENDER_SCRIPT = r"""async (context) => {
  window.__aeSeed(context.seed);
  context.random = Math.random;
  await window.renderFrame(Object.freeze(context));
  for (const animation of document.getAnimations()) {
    animation.pause();
    animation.currentTime = context.time * 1000;
  }
  await document.fonts.ready;
  await Promise.all([...document.images].map(image => image.decode()));
  if (window.__aeViolations.length) throw new Error('Only local scene assets are allowed: ' + window.__aeViolations.join(', '));
}"""


class FrameRenderer:
    """One isolated browser context. Exposed for random-order seek verification."""
    def __init__(self, playwright, scene: Scene, origin: str, *, executable_path=None, timeout=30):
        launch = dict(headless=True)
        if executable_path:
            launch["executable_path"] = str(Path(executable_path).expanduser().resolve(strict=True))
        try:
            self.browser = playwright.chromium.launch(**launch)
        except Exception as exc:
            raise RuntimeError("Chromium could not start. Run ae-generative setup (or python -m playwright install chromium), or supply --browser with an installed Chromium executable. Browser error: " + str(exc)) from exc
        self.scene = scene
        self.errors = []
        try:
            self.context = self.browser.new_context(viewport={"width": scene.width, "height": scene.height},
                                                    device_scale_factor=1, locale="en-US", timezone_id="UTC",
                                                    color_scheme="light", reduced_motion="reduce", service_workers="block")
            self.context.set_default_timeout(timeout * 1000)
            self.context.route("**/*", self._route(origin))
            self.context.route_web_socket("**/*", lambda ws: (self.errors.append("WebSockets are not supported"), ws.close()))
            self.context.add_init_script(INIT_SCRIPT.replace("SEED", str(scene.seed)))
            self.page = self.context.new_page()
            self.cdp = self.context.new_cdp_session(self.page)
            self.page.on("pageerror", lambda error: self.errors.append(str(error)))
            self.page.on("response", lambda response: self.errors.append(f"Asset HTTP {response.status}: {response.url}") if response.status >= 400 else None)
            self.page.goto(origin + "/" + quote(scene.entry, safe="/"), wait_until="load")
            self._evaluate(READY_SCRIPT, None, timeout)
            self.check_errors()
        except BaseException:
            self.browser.close()
            raise
        self.timeout = timeout

    def _route(self, origin):
        def route(request):
            url = request.request.url
            parsed = urlsplit(url)
            if url.startswith(origin + "/") or parsed.scheme in ("data", "blob"):
                request.continue_()
            else:
                self.errors.append(f"External asset blocked: {url}")
                request.abort()
        return route

    def _evaluate(self, function, argument, timeout):
        # CDP bounds synchronous JS too; a Promise timer alone cannot stop a busy loop.
        expression = """(async ({source, argument, timeout}) => {
          let timer;
          try { return await Promise.race([
            (0, eval)('(' + source + ')')(argument),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Scene timed out')), timeout); })
          ]); } finally { clearTimeout(timer); }
        })(""" + json.dumps({"source": function, "argument": argument, "timeout": timeout * 1000}) + ")"
        try:
            result = self.cdp.send("Runtime.evaluate", {"expression": expression, "awaitPromise": True,
                                                       "returnByValue": True, "timeout": timeout * 1000})
        except Exception as exc:
            raise RuntimeError(f"Scene evaluation failed or exceeded its {timeout}s execution timeout: {exc}") from exc
        if "exceptionDetails" in result:
            details = result["exceptionDetails"]
            raise RuntimeError(details.get("exception", {}).get("description", details.get("text", "Scene failed")))
        return result.get("result", {}).get("value")

    def check_errors(self):
        if self.errors:
            raise RuntimeError("Scene failed: " + "; ".join(self.errors))

    def capture(self, frame: int, output: Path):
        if type(frame) is not int or not 0 <= frame < self.scene.frames:
            raise ValueError("Frame is outside the declared range")
        scene = self.scene
        context = dict(frame=frame, time=float(Fraction(frame) / scene.fps),
                       deltaTime=float(1 / scene.fps), width=scene.width, height=scene.height,
                       fps=float(scene.fps), frameCount=scene.frames, seed=scene.seed)
        self._evaluate(RENDER_SCRIPT, context, self.timeout)
        self.check_errors()
        self.page.screenshot(path=str(output), type="png", omit_background=scene.alpha,
                             full_page=False, caret="hide", scale="css")
        self.check_errors()

    def close(self):
        self.browser.close()


def render_scene(directory, output, *, executable_path=None, timeout=30):
    scene = Scene.load(directory)
    output = Path(output).expanduser().resolve()
    if output.is_relative_to(scene.root):
        raise ValueError("Output must be outside the scene source directory")
    if type(timeout) not in (int, float) or not 0 < timeout <= 3600:
        raise ValueError("timeout must be in (0, 3600] seconds")
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError("Install the core runtime first: python -m pip install 'playwright==1.65.0'") from exc
    output.mkdir(parents=True, exist_ok=False)
    # A failed run leaves evidence, but never a successful render.json marker.
    sources = archive_source(scene, output / "source")
    scene = Scene.load(output / "source")
    frames_dir = output / "frames"
    frames_dir.mkdir()
    records = []
    with serve_scene(scene.root) as origin, sync_playwright() as playwright:
        renderer = FrameRenderer(playwright, scene, origin, executable_path=executable_path, timeout=timeout)
        try:
            browser_version = renderer.browser.version
            for frame in range(scene.frames):
                path = frames_dir / f"frame_{frame:06d}.png"
                renderer.capture(frame, path)
                records.append({"file": path.relative_to(output).as_posix(), "sha256": sha256(path)})
        finally:
            renderer.close()
    manifest = dict(version=1, scene=scene.metadata(), duration=str(Fraction(scene.frames) / scene.fps),
                    source="source", sourceHashes=sources, frames=records,
                    renderer={"engine": "chromium", "browserVersion": browser_version,
                              "playwrightVersion": importlib.metadata.version("playwright"),
                              "deviceScaleFactor": 1, "alphaMode": "straight" if scene.alpha else "opaque"})
    (output / "render.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return output / "render.json"

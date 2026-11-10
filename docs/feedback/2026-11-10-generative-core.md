# Core generative footage validation

Initial validation performed locally on 2026-11-10 before release preparation.

## Implemented route

Trusted local HTML/Canvas/SVG/WebGL scene → explicit seeded frame rendering →
transparent PNG sequence + archived source and hashes → py-aep footage/layer →
new editable `.aep`. The renderer is part of the default py-aep skill and Python
package; it does not require Sandbox or another third-party AE plugin.

## Evidence

- Bundled floating-icons example: 640 × 360, 90 frames, 30000/1001 fps, seed 17,
  transparent PNG. Chromium 157.0.8103.39, Playwright 1.65.0.
- Browser tests verify repeatable hashes, out-of-order frame seeks, changed seed,
  transparent/opaque pixels, local asset readiness, and missing/external assets.
- Sequence imported with straight alpha, saved once offline and reparsed.
- Opened in After Effects 26.5x89. Changed native layer opacity to 85%, saved a
  separate native AEP, and reopened that file. The opacity persisted.
- Runtime inventory after reopening: one 640 × 360 composition and one online
  sequence layer, 29.9700317382812 fps, 3.003003003003 seconds. Fractional timing
  reflects AE's native rate quantization; browser frame time is exact rational.
- Purged all AE caches successfully, then visually inspected the reopened
  composition at frames 0, 45, and 89 in AE's UI. Different expected star positions
  appeared at each frame, with no missing-footage display.
- Scripted PNG/report export was blocked by AE's disabled file-write/network
  preference. It was not changed. Native visual inspection used the app UI;
  no native exported-PNG comparison is claimed.
- The previously open saved project was restored and confirmed clean.
- Full Python suite with opt-in browser tests: 224 passed. Node suite: 81 passed.
- Wheel built with both Python packages and the console entrypoint. npm archive
  and Codex/Gemini/Claude copy tests include the runtime, example, and reference.

## Editability boundary

Artwork inside the sequence is raster. Its AE layer properties, native effects,
compositing, timing, and surrounding layers remain editable. Change the archived
code and render again to change the artwork; no claim of conversion to AE-native
shapes/text is made. Pixel identity is only expected with the same inputs and
browser/OS/font/GPU environment.

## 0.15.0 release validation

- Replaced global/user pip installation with a dedicated venv and stable Python/CLI
  launchers. Tested real wheel installation from Homebrew Python while another venv
  was active, including a home path containing spaces and an apostrophe.
- Simulated an unreachable browser CDN: CLI and all three agent skills remained
  installed. A second install recovered with a fresh managed Chromium download;
  the previous environment and legacy launcher were retained.
- Pinned Playwright 1.65.0. Managed Chromium 158.0.8127.18 is required unless an
  explicit browser path is supplied; system Chrome is no longer a silent fallback.
- Real browser regressions cover Canvas/SVG/WebGL, alpha, fractional frame times,
  repeated and out-of-order frames, blocked external/missing assets, and bounded
  failures. Linux/macOS CI and release publication now enable browser tests.
- An independent After Effects 26.5x89 aerender process (without `-reuse`) opened,
  rendered and saved a new 128×128, three-frame, 30000/1001-fps AEP. Reparse retained
  the single composition/layer, frame count and straight-alpha source. ffprobe
  confirmed three output movie frames. The user's open AE project was not reused.
- Independent review caught lost ae-cli error exit codes in the new launchers;
  launchers now propagate return status and include a regression test.
- Final local checks: 235 Python tests (including 85 generative tests) and 90 Node
  tests passed with no skips; skill validation passed. The npm package contains all
  required runtime/example/reference files and no private keys, work outputs or caches.

"""Command line for core code-authored visuals. Never changes a running AE project."""
from __future__ import annotations

import argparse
import subprocess
import sys

from .renderer import render_scene
from .aep import create_project


def run(argv=None):
    parser = argparse.ArgumentParser(prog="ae-generative", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("setup", help="Install the official Playwright Chromium runtime")
    render = commands.add_parser("render", help="Render a trusted local scene to a new PNG sequence directory")
    render.add_argument("scene")
    render.add_argument("--output", required=True)
    render.add_argument("--browser", help="Installed Chromium executable (otherwise managed Chromium)")
    render.add_argument("--timeout", type=float, default=30, help="Per-frame async timeout, seconds")
    project = commands.add_parser("project", help="Import a rendered sequence into a new editable AEP")
    project.add_argument("render_json")
    project.add_argument("--output", required=True)
    project.add_argument("--ae-version", required=True)
    project.add_argument("--name", default="Generative")
    args = parser.parse_args(argv)
    browser_errors = ()
    if args.command == "render":
        # Keep setup/help/project usable before Playwright has been installed.
        try:
            from playwright.sync_api import Error as PlaywrightError
        except ImportError:
            pass
        else:
            browser_errors = (PlaywrightError,)
    try:
        if args.command == "setup":
            subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
        elif args.command == "render":
            print(render_scene(args.scene, args.output, executable_path=args.browser, timeout=args.timeout))
        else:
            print(create_project(args.render_json, args.output, ae_version=args.ae_version, name=args.name))
    except subprocess.CalledProcessError as exc:
        parser.exit(1, f"ae-generative: Chromium setup failed (exit {exc.returncode}). "
                    "Resolve the network or installation error above, then rerun ae-generative setup.\n")
    except (ValueError, OSError, RuntimeError) + browser_errors as exc:
        guidance = (" No successful render.json was published by this attempt. "
                    "Fix the reported problem, then retry with a new --output directory."
                    if args.command == "render" else "")
        parser.exit(1, f"ae-generative: {exc}{guidance}\n")


if __name__ == "__main__":
    run()

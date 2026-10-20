#!/usr/bin/env python3
"""Fail if the problem folders do not match the layout."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "metrics"))

from layout import LayoutError, discover, load_limits  # noqa: E402
from versions import VersionError, validate_tree  # noqa: E402


def check() -> None:
    load_limits()
    leftover = sorted(ROOT.glob("problems/*/problem.md"))
    if leftover:
        raise LayoutError("problem.md is not used: " + ", ".join(path.relative_to(ROOT).as_posix() for path in leftover))
    discover()
    try:
        validate_tree(ROOT)
    except VersionError as exc:
        raise LayoutError(str(exc)) from exc


def main() -> int:
    try:
        check()
    except (LayoutError, OSError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    print("layout: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

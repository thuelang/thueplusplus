#!/usr/bin/env python3
"""Fail when a solution version is misnamed, mistimed, or edited after it landed.

`--history` also requires the same number of versions as `git log --follow` for
the old solution.<ext> path. A ruleset that never had that path is skipped.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "metrics"))

from versions import VersionError, compare_history, validate_tree  # noqa: E402


def main() -> int:
    history = "--history" in sys.argv[1:]
    try:
        validate_tree(ROOT)
        if history:
            compare_history(ROOT)
    except VersionError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    print("versions ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Copy every historical solution.<ext> into a timestamped version directory.

The timestamp is the commit's committer time in UTC, YYYY-MM-DD_HH-MM-SS.
The file name is the slug of the solution's title. A slug that is already on
disk is skipped. The old solution file and metric.json are removed. README
frontmatter drops entry.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "metrics"))

from solution_frontmatter import SolutionFrontmatterError, slugify, split_solution  # noqa: E402
from versions import VersionError, format_timestamp, history_versions  # noqa: E402


def main() -> int:
    try:
        migrated = migrate(ROOT)
    except (VersionError, OSError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    print(f"versions: migrated {migrated}")
    return 0


def migrate(root: Path) -> int:
    written = 0
    for path in sorted(root.glob("problems/*/solutions/*/solution.*")):
        if not path.is_file():
            continue
        written += _migrate_file(root, path)
        path.unlink()
        metric = path.parent / "metric.json"
        if metric.is_file():
            metric.unlink()
        _rewrite_readme(path.parent / "README.md")
    return written


def _migrate_file(root: Path, path: Path) -> int:
    relative = path.relative_to(root).as_posix()
    extension = path.name.removeprefix("solution.")
    if not extension or "/" in extension or extension == path.name:
        raise VersionError(f"{relative} is not solution.<ext>")
    seen = {item.name.split(".", 1)[0] for item in path.parent.glob("*/*") if item.is_file() and "." in item.name}
    written = 0
    for moment, blob in history_versions(root, relative):
        try:
            fields, _body = split_solution(blob, extension)
        except SolutionFrontmatterError as exc:
            raise VersionError(f"{relative}: {exc}") from exc
        title = fields.get("title", "")
        if not title:
            raise VersionError(f"{relative} at {format_timestamp(moment)} has no title")
        slug = slugify(title)
        if slug in seen:
            continue
        folder = path.parent / format_timestamp(moment)
        if folder.exists():
            raise VersionError(f"{folder.relative_to(root).as_posix()} already exists")
        folder.mkdir(parents=True)
        (folder / f"{slug}.{extension}").write_bytes(blob)
        seen.add(slug)
        written += 1
    if written == 0 and not any(path.parent.glob("*/*.*")):
        raise VersionError(f"{relative} has no committed bytes to migrate")
    return written


def _rewrite_readme(path: Path) -> None:
    if not path.is_file():
        raise VersionError(f"{path} is missing")
    text = path.read_text(encoding="utf-8")
    lines = []
    for line in text.splitlines(keepends=True):
        if line.startswith("entry:"):
            continue
        lines.append(line.replace("The program is `solution.thue`.", "The current program is the newest timestamped file."))
    path.write_text("".join(lines), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())

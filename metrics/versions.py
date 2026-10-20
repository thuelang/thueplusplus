"""Solution versions live in problems/<slug>/solutions/<sandbox>/<timestamp>/.

The directory holds the program and a README.md. `title` is required there.
`author` is optional. The program file name is `slugify(title)` plus the extension.
"""

from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from frontmatter import FrontmatterError, parse_frontmatter

ROOT = Path(__file__).resolve().parents[1]
TIMESTAMP_RE = re.compile(r"^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$")
SLUG_FILE_RE = re.compile(r"^([a-z0-9]+(?:-[a-z0-9]+)*)\.([a-z0-9]+)$")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
STAMP_FORMAT = "%Y-%m-%d_%H-%M-%S"
VERSION_KEYS = frozenset({"title", "author"})
# Comment prefixes from #172. Immutability ignores that header so the move
# into README.md is the same program.
_LEGACY_PREFIXES = ("// ", "; ", "\\ ", "REM ", "")


class VersionError(ValueError):
    pass


@dataclass(frozen=True)
class Version:
    problem: str
    ruleset: str
    timestamp: str
    slug: str
    extension: str
    rel: str

    @property
    def name(self) -> str:
        return f"{self.slug}.{self.extension}"


def format_timestamp(moment: datetime) -> str:
    if moment.tzinfo is None:
        raise VersionError("a version timestamp needs a timezone")
    return moment.astimezone(timezone.utc).strftime(STAMP_FORMAT)


def parse_timestamp(text: str) -> datetime:
    if TIMESTAMP_RE.fullmatch(text) is None:
        raise VersionError(f"{text} is not a UTC timestamp like 2026-10-20_14-34-00")
    try:
        parsed = datetime.strptime(text, STAMP_FORMAT).replace(tzinfo=timezone.utc)
    except ValueError as exc:
        raise VersionError(f"{text} is not a real UTC time") from exc
    if format_timestamp(parsed) != text:
        raise VersionError(f"{text} is not a real UTC time")
    return parsed


def stamp_to_iso(text: str) -> str:
    return parse_timestamp(text).strftime("%Y-%m-%dT%H:%M:%SZ")


def slugify(title: str) -> str:
    """Lowercase ASCII. Runs of non-alphanumerics become one hyphen."""
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    if SLUG_RE.fullmatch(slug) is None:
        raise VersionError(f"title {title!r} has an empty slug")
    return slug


def legacy_program(data: bytes) -> bytes:
    """Return the program bytes, dropping a #172 comment header when present."""
    for prefix in _LEGACY_PREFIXES:
        opener = f"{prefix}---\n".encode("ascii")
        if not data.startswith(opener):
            continue
        closer = f"{prefix}---".encode("ascii")
        pre = prefix.encode("ascii")
        offset = len(opener)
        valid = True
        while True:
            newline = data.find(b"\n", offset)
            if newline < 0:
                valid = data[offset:] == closer
                end = len(data)
                body = b""
                break
            line = data[offset:newline]
            if line == closer:
                end = newline + 1
                body = data[end:]
                break
            if prefix and not line.startswith(pre):
                valid = False
                break
            offset = newline + 1
        else:
            valid = False
        if valid:
            return body
    return data


def iter_versions(root: Path = ROOT) -> list[Version]:
    found: list[Version] = []
    problems = root / "problems"
    if not problems.is_dir():
        return found
    for problem_dir in sorted(path for path in problems.iterdir() if path.is_dir()):
        solutions = problem_dir / "solutions"
        if not solutions.is_dir():
            continue
        for ruleset_dir in sorted(path for path in solutions.iterdir() if path.is_dir()):
            found.extend(versions_in(root, problem_dir.name, ruleset_dir))
    return found


def versions_in(root: Path, problem: str, ruleset_dir: Path) -> list[Version]:
    ruleset = ruleset_dir.name
    found: list[Version] = []
    for entry in sorted(ruleset_dir.iterdir(), key=lambda path: path.name):
        if entry.name in {"README.md"} or not entry.is_dir():
            continue
        if TIMESTAMP_RE.fullmatch(entry.name) is None:
            raise VersionError(f"{_rel(root, entry)} is not a UTC timestamp like 2026-10-20_14-34-00")
        parse_timestamp(entry.name)
        children = list(entry.iterdir())
        stray = [path.name for path in children if not path.is_file()]
        if stray:
            raise VersionError(f"{_rel(root, entry)}: unexpected {', '.join(sorted(stray))}")
        readme = entry / "README.md"
        programs = [path for path in children if path.is_file() and path.name != "README.md"]
        if len(programs) == 0:
            raise VersionError(f"{_rel(root, entry)} needs one solution file")
        if len(programs) != 1:
            names = ", ".join(sorted(path.name for path in programs))
            raise VersionError(f"{_rel(root, entry)}: unexpected {names}")
        program = programs[0]
        match = SLUG_FILE_RE.fullmatch(program.name)
        if match is None:
            raise VersionError(f"{_rel(root, program)} is not a title slug and an extension")
        slug, extension = match.group(1), match.group(2)
        if not readme.is_file():
            raise VersionError(f"{_rel(root, entry)} needs README.md")
        try:
            fields, _body = parse_frontmatter(readme.read_text(encoding="utf-8"), _rel(root, readme))
        except FrontmatterError as exc:
            raise VersionError(str(exc)) from exc
        unknown = sorted(set(fields) - VERSION_KEYS)
        if unknown:
            raise VersionError(f"{_rel(root, readme)}: unknown front matter key {unknown[0]!r}")
        title = fields.get("title", "")
        if not title:
            raise VersionError(f"{_rel(root, readme)}: front matter needs title")
        expect = slugify(title)
        if slug != expect:
            raise VersionError(f"{_rel(root, program)}: file name must be {expect}.{extension}")
        found.append(Version(problem, ruleset, entry.name, slug, extension, _rel(root, program)))
    if len({item.timestamp for item in found}) != len(found):
        raise VersionError(f"problems/{problem}/solutions/{ruleset} has two versions at one timestamp")
    return found


def current_version(versions: list[Version]) -> Version:
    if not versions:
        raise VersionError("a sandbox has no solution versions")
    return max(versions, key=lambda item: item.timestamp)


def assert_immutable(root: Path, rel: str, *, program: bool = False) -> None:
    log = _git(root, "log", "--format=%H", "--", rel)
    commits = [line for line in log.splitlines() if line]
    if commits and _git(root, "status", "--porcelain", "--", rel).strip():
        raise VersionError(f"{rel} was modified after it was added")
    blobs: list[bytes] = []
    for commit in commits:
        blob = _git_bytes(root, "cat-file", "blob", f"{commit}:{rel}")
        if blob is None:
            continue
        blobs.append(legacy_program(blob) if program else blob)
    if len(set(blobs)) > 1:
        raise VersionError(f"{rel} was modified after it was added")


def validate_tree(root: Path = ROOT) -> None:
    for version in iter_versions(root):
        assert_immutable(root, version.rel, program=True)
        readme = Path("problems") / version.problem / "solutions" / version.ruleset / version.timestamp / "README.md"
        assert_immutable(root, readme.as_posix())


def history_versions(root: Path, relative: str) -> list[tuple[datetime, bytes]]:
    """Every past blob of a solution file, oldest committer time first.

    `git log --follow` keeps bytes from before a rename. It also drops some
    files that were added in a merge, so the current path is read without
    `--follow` and the two sets are combined. Identical bytes keep the latest
    committer time, so the newest directory matches HEAD.
    """
    rows = _log_paths(root, relative, follow=True)
    rows.extend(_log_paths(root, relative, follow=False))
    rows.sort(key=lambda item: (item[0], item[1]))
    latest: dict[bytes, tuple[datetime, bytes]] = {}
    for moment, commit, path in rows:
        blob = _git_bytes(root, "cat-file", "blob", f"{commit}:{path}")
        if blob is None:
            continue
        latest[blob] = (moment, blob)
    return [latest[blob] for blob in sorted(latest, key=lambda item: latest[item][0])]


def compare_history(root: Path = ROOT) -> None:
    grouped: dict[tuple[str, str, str], int] = {}
    for version in iter_versions(root):
        key = (version.problem, version.ruleset, version.extension)
        grouped[key] = grouped.get(key, 0) + 1
    for (problem, ruleset, extension), disk in sorted(grouped.items()):
        old = f"problems/{problem}/solutions/{ruleset}/solution.{extension}"
        historical = history_versions(root, old)
        if not historical:
            continue
        if len(historical) != disk:
            raise VersionError(f"{problem}/{ruleset} history {len(historical)} != disk {disk}")


def _rel(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


def _log_paths(root: Path, relative: str, *, follow: bool) -> list[tuple[datetime, str, str]]:
    args = ["log", "--name-only", "--format=%H%x09%cI", "--", relative]
    if follow:
        args.insert(1, "--follow")
    rows: list[tuple[datetime, str, str]] = []
    commit = ""
    moment: datetime | None = None
    paths: list[str] = []

    def flush() -> None:
        if moment is None or not commit:
            return
        chosen = paths or [relative]
        for path in chosen:
            rows.append((moment, commit, path))

    for line in _git(root, *args).splitlines():
        if "\t" in line and not line.startswith(":"):
            flush()
            commit, stamp = line.split("\t", 1)
            if len(commit) != 40:
                raise VersionError(f"bad commit line {line}")
            moment = datetime.fromisoformat(stamp)
            paths = []
            continue
        if line.strip():
            paths.append(line.strip())
    flush()
    return rows


def _git(root: Path, *args: str) -> str:
    completed = subprocess.run(["git", *args], cwd=root, capture_output=True, text=True)
    if completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip() or f"exit {completed.returncode}"
        raise VersionError(detail)
    return completed.stdout


def _git_bytes(root: Path, *args: str) -> bytes | None:
    completed = subprocess.run(["git", *args], cwd=root, capture_output=True)
    if completed.returncode != 0:
        return None
    return completed.stdout

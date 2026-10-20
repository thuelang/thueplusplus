"""Solution versions live in problems/<slug>/solutions/<sandbox>/<timestamp>/<hash>.<ext>."""

from __future__ import annotations

import hashlib
import re
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TIMESTAMP_RE = re.compile(r"^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$")
HASH_FILE_RE = re.compile(r"^([0-9a-f]{12})\.([a-z0-9]+)$")
STAMP_FORMAT = "%Y-%m-%d_%H-%M-%S"


class VersionError(ValueError):
    pass


@dataclass(frozen=True)
class Version:
    problem: str
    ruleset: str
    timestamp: str
    hash: str
    extension: str
    rel: str

    @property
    def name(self) -> str:
        return f"{self.hash}.{self.extension}"


def file_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:12]


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
        programs = [path for path in entry.iterdir() if path.is_file() and HASH_FILE_RE.fullmatch(path.name) and path.suffix != ".md"]
        notes = [path for path in entry.iterdir() if path.is_file() and path.suffix == ".md"]
        extra = [path.name for path in entry.iterdir() if path not in programs and path not in notes]
        if extra:
            raise VersionError(f"{_rel(root, entry)}: unexpected {', '.join(sorted(extra))}")
        if len(programs) != 1:
            raise VersionError(f"{_rel(root, entry)} needs one solution file")
        program = programs[0]
        match = HASH_FILE_RE.fullmatch(program.name)
        if match is None:
            raise VersionError(f"{_rel(root, program)} is not a hash and an extension")
        digest, extension = match.group(1), match.group(2)
        data = program.read_bytes()
        actual = file_hash(data)
        if actual != digest:
            raise VersionError(f"{_rel(root, program)} hash is {actual}")
        if notes and (len(notes) != 1 or notes[0].name != f"{digest}.md"):
            raise VersionError(f"{_rel(root, entry)} notes must be {digest}.md")
        found.append(Version(problem, ruleset, entry.name, digest, extension, _rel(root, program)))
    if len({item.timestamp for item in found}) != len(found):
        raise VersionError(f"problems/{problem}/solutions/{ruleset} has two versions at one timestamp")
    if len({item.hash for item in found}) != len(found):
        raise VersionError(f"problems/{problem}/solutions/{ruleset} repeats a solution hash")
    return found


def current_version(versions: list[Version]) -> Version:
    if not versions:
        raise VersionError("a sandbox has no solution versions")
    return max(versions, key=lambda item: item.timestamp)


def assert_immutable(root: Path, rel: str) -> None:
    log = _git(root, "log", "--format=%H", "--", rel)
    commits = [line for line in log.splitlines() if line]
    if len(commits) > 1:
        raise VersionError(f"{rel} was modified after it was added")
    if commits and _git(root, "status", "--porcelain", "--", rel).strip():
        raise VersionError(f"{rel} was modified after it was added")


def validate_tree(root: Path = ROOT) -> None:
    for version in iter_versions(root):
        assert_immutable(root, version.rel)
        notes = Path("problems") / version.problem / "solutions" / version.ruleset / version.timestamp / f"{version.hash}.md"
        if (root / notes).is_file():
            assert_immutable(root, notes.as_posix())


def history_versions(root: Path, relative: str) -> list[tuple[datetime, bytes]]:
    """Every past blob of a solution file, oldest committer time first.

    `git log --follow` keeps bytes from before a rename. It also drops some
    files that were added in a merge, so the current path is read without
    `--follow` and the two sets are combined. A repeated hash keeps the
    earlier timestamp.
    """
    rows = _log_paths(root, relative, follow=True)
    rows.extend(_log_paths(root, relative, follow=False))
    rows.sort(key=lambda item: (item[0], item[1]))
    # One directory per hash. The timestamp is the latest committer time at
    # which that blob was current, so the newest directory matches HEAD.
    latest: dict[str, tuple[datetime, bytes]] = {}
    for moment, commit, path in rows:
        blob = _git_bytes(root, "cat-file", "blob", f"{commit}:{path}")
        if blob is None:
            continue
        latest[file_hash(blob)] = (moment, blob)
    return [latest[digest] for digest in sorted(latest, key=lambda item: latest[item][0])]


def history_hashes(root: Path, problem: str, ruleset: str, extension: str) -> set[str]:
    old = f"problems/{problem}/solutions/{ruleset}/solution.{extension}"
    return {file_hash(blob) for _moment, blob in history_versions(root, old)}


def compare_history(root: Path = ROOT) -> None:
    grouped: dict[tuple[str, str, str], set[str]] = {}
    for version in iter_versions(root):
        grouped.setdefault((version.problem, version.ruleset, version.extension), set()).add(version.hash)
    for (problem, ruleset, extension), disk in sorted(grouped.items()):
        historical = history_hashes(root, problem, ruleset, extension)
        if not historical:
            continue
        if historical != disk:
            missing = sorted(historical - disk)
            extra = sorted(disk - historical)
            raise VersionError(
                f"{problem}/{ruleset} history {len(historical)} != disk {len(disk)}"
                + (f" missing {', '.join(missing)}" if missing else "")
                + (f" extra {', '.join(extra)}" if extra else "")
            )


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

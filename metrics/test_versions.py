#!/usr/bin/env python3
"""Version directories: hash, timestamp, immutability, and history."""

import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "metrics"))

from versions import (  # noqa: E402
    VersionError,
    assert_immutable,
    compare_history,
    file_hash,
    format_timestamp,
    parse_timestamp,
    versions_in,
)


def _git(root: Path, *args: str, date: str | None = None) -> None:
    env = None
    if date is not None:
        env = dict(**subprocess.os.environ)
        env["GIT_AUTHOR_DATE"] = date
        env["GIT_COMMITTER_DATE"] = date
    subprocess.run(["git", *args], cwd=root, check=True, capture_output=True, env=env)


def _init(root: Path) -> None:
    _git(root, "init")
    _git(root, "config", "user.email", "ada@example.com")
    _git(root, "config", "user.name", "Ada Lovelace")
    _git(root, "config", "commit.gpgsign", "false")


class VersionTest(unittest.TestCase):
    def test_hash_is_twelve_hex_characters(self) -> None:
        digest = file_hash(b"abc")
        self.assertEqual(digest, "ba7816bf8f01")
        self.assertEqual(len(digest), 12)

    def test_timestamp_is_utc_basic_shape(self) -> None:
        moment = datetime(2026, 10, 20, 14, 34, tzinfo=timezone.utc)
        self.assertEqual(format_timestamp(moment), "2026-10-20_14-34-00")
        self.assertEqual(parse_timestamp("2026-10-20_14-34-00"), moment)
        with self.assertRaises(VersionError):
            parse_timestamp("20261020T143400Z")
        with self.assertRaises(VersionError):
            parse_timestamp("2026-02-31_00-00-00")

    def test_a_version_edited_after_it_was_added_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _init(root)
            path = root / "problems" / "hello-world" / "solutions" / "lisp" / "2026-10-20_14-34-00"
            path.mkdir(parents=True)
            program = path / "ba7816bf8f01.lisp"
            program.write_bytes(b"abc")
            _git(root, "add", ".")
            _git(root, "commit", "-m", "add")
            assert_immutable(root, "problems/hello-world/solutions/lisp/2026-10-20_14-34-00/ba7816bf8f01.lisp")
            program.write_bytes(b"abcd")
            with self.assertRaises(VersionError) as caught:
                assert_immutable(root, "problems/hello-world/solutions/lisp/2026-10-20_14-34-00/ba7816bf8f01.lisp")
            self.assertIn("modified after it was added", str(caught.exception))

    def test_discover_returns_only_the_newest_version(self) -> None:
        from layout import discover
        from versions import current_version

        found = discover()
        self.assertGreater(len(found), 0)
        seen: set[tuple[str, str]] = set()
        for solution in found:
            key = (solution.problem, solution.ruleset)
            self.assertNotIn(key, seen)
            seen.add(key)
            directory = ROOT / "problems" / solution.problem / "solutions" / solution.ruleset
            versions = versions_in(ROOT, solution.problem, directory)
            current = current_version(versions)
            self.assertEqual(solution.hash, current.hash)
            self.assertEqual(solution.timestamp, current.timestamp)
            self.assertTrue(all(item.timestamp < current.timestamp for item in versions if item.hash != current.hash))

    def test_history_count_matches_follow_and_rejects_a_tie(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _init(root)
            ruleset = root / "problems" / "hello-world" / "solutions" / "lisp"
            ruleset.mkdir(parents=True)
            (ruleset / "README.md").write_text("---\nruleset: lisp\nauthor: Ada <ada@example.com>\n---\n\nNotes.\n", encoding="utf-8")
            old = ruleset / "solution.lisp"
            old.write_text("one\n", encoding="utf-8")
            _git(root, "add", ".", date="2026-10-18T14:34:00Z")
            _git(root, "commit", "-m", "one", date="2026-10-18T14:34:00Z")
            old.write_text("two\n", encoding="utf-8")
            _git(root, "add", ".", date="2026-10-19T15:00:00Z")
            _git(root, "commit", "-m", "two", date="2026-10-19T15:00:00Z")
            from migrate_versions import migrate

            self.assertEqual(migrate(root), 2)
            compare_history(root)
            bad = ruleset / "2026-10-20_14-34-00"
            bad.mkdir()
            (bad / "000000000000.lisp").write_bytes(b"abc")
            with self.assertRaises(VersionError) as caught:
                versions_in(root, "hello-world", ruleset)
            self.assertIn("hash is", str(caught.exception))


if __name__ == "__main__":
    unittest.main()

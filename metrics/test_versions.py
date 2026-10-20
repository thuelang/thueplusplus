#!/usr/bin/env python3
"""Version directories: title slug, timestamp, immutability, and history."""

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
    format_timestamp,
    parse_timestamp,
    slugify,
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
    def test_timestamp_is_utc_basic_shape(self) -> None:
        moment = datetime(2026, 10, 20, 14, 34, tzinfo=timezone.utc)
        self.assertEqual(format_timestamp(moment), "2026-10-20_14-34-00")
        self.assertEqual(parse_timestamp("2026-10-20_14-34-00"), moment)
        with self.assertRaises(VersionError):
            parse_timestamp("20261020T143400Z")
        with self.assertRaises(VersionError):
            parse_timestamp("2026-02-31_00-00-00")

    def test_slug_is_lowercase_ascii_with_single_hyphens(self) -> None:
        self.assertEqual(slugify("Loop with mod 15"), "loop-with-mod-15")
        self.assertEqual(slugify("Hard-coded lines"), "hard-coded-lines")
        self.assertEqual(slugify("  Mod 400, 4, and 100  "), "mod-400-4-and-100")
        with self.assertRaises(VersionError):
            slugify("---")

    def test_readme_title_must_match_the_file_name(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            ruleset = Path(tmp) / "problems" / "hello-world" / "solutions" / "lisp"
            folder = ruleset / "2026-10-20_14-34-00"
            folder.mkdir(parents=True)
            (folder / "sample.lisp").write_text("(add 1 2)\n", encoding="utf-8")
            with self.assertRaises(VersionError) as missing:
                versions_in(Path(tmp), "hello-world", ruleset)
            self.assertIn("needs README.md", str(missing.exception))
            (folder / "README.md").write_text("---\nauthor: Ada <ada@example.com>\n---\n", encoding="utf-8")
            with self.assertRaises(VersionError) as untitled:
                versions_in(Path(tmp), "hello-world", ruleset)
            self.assertIn("needs title", str(untitled.exception))
            (folder / "README.md").write_text("---\ntitle: Other name\n---\n", encoding="utf-8")
            with self.assertRaises(VersionError) as mismatch:
                versions_in(Path(tmp), "hello-world", ruleset)
            self.assertIn("file name must be other-name.lisp", str(mismatch.exception))
            (folder / "README.md").write_text("---\ntitle: Sample\nnote: extra\n---\n", encoding="utf-8")
            with self.assertRaises(VersionError) as unknown:
                versions_in(Path(tmp), "hello-world", ruleset)
            self.assertIn("unknown front matter key 'note'", str(unknown.exception))
            (folder / "README.md").write_text("---\ntitle: A :: pair\n---\n", encoding="utf-8")
            (folder / "sample.lisp").rename(folder / "a-pair.lisp")
            self.assertEqual(versions_in(Path(tmp), "hello-world", ruleset)[0].slug, "a-pair")
            (folder / "a-pair.lisp").rename(folder / "sample.lisp")
            (folder / "README.md").write_text("---\ntitle: Sample\n---\n", encoding="utf-8")
            (folder / "extra.txt").write_text("nope\n", encoding="utf-8")
            with self.assertRaises(VersionError) as extra:
                versions_in(Path(tmp), "hello-world", ruleset)
            self.assertIn("unexpected", str(extra.exception))

    def test_a_version_edited_after_it_was_added_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _init(root)
            path = root / "problems" / "hello-world" / "solutions" / "lisp" / "2026-10-20_14-34-00"
            path.mkdir(parents=True)
            program = path / "sample.lisp"
            program.write_bytes(b"abc")
            _git(root, "add", ".")
            _git(root, "commit", "-m", "add")
            rel = "problems/hello-world/solutions/lisp/2026-10-20_14-34-00/sample.lisp"
            assert_immutable(root, rel)
            program.write_bytes(b"abcd")
            with self.assertRaises(VersionError) as caught:
                assert_immutable(root, rel, program=True)
            self.assertIn("modified after it was added", str(caught.exception))
            program.write_bytes(b"; ---\n; title: Sample\n; ---\nabc")
            _git(root, "add", ".")
            _git(root, "commit", "-m", "header")
            program.write_bytes(b"abc")
            _git(root, "add", ".")
            _git(root, "commit", "-m", "strip")
            assert_immutable(root, rel, program=True)
            program.write_bytes(b"abcd")
            _git(root, "add", ".")
            _git(root, "commit", "-m", "edit")
            with self.assertRaises(VersionError) as edited:
                assert_immutable(root, rel, program=True)
            self.assertIn("modified after it was added", str(edited.exception))

    def test_history_count_matches_follow_and_rejects_a_tie(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _init(root)
            ruleset = root / "problems" / "hello-world" / "solutions" / "lisp"
            ruleset.mkdir(parents=True)
            (ruleset / "README.md").write_text("---\nruleset: lisp\nauthor: Ada <ada@example.com>\n---\n\nNotes.\n", encoding="utf-8")
            old = ruleset / "solution.lisp"
            old.write_text("; ---\n; title: One\n; ---\none\n", encoding="utf-8")
            _git(root, "add", ".", date="2026-10-18T14:34:00Z")
            _git(root, "commit", "-m", "one", date="2026-10-18T14:34:00Z")
            old.write_text("; ---\n; title: Two\n; ---\ntwo\n", encoding="utf-8")
            _git(root, "add", ".", date="2026-10-19T15:00:00Z")
            _git(root, "commit", "-m", "two", date="2026-10-19T15:00:00Z")
            from migrate_versions import migrate

            self.assertEqual(migrate(root), 2)
            compare_history(root)
            bad = ruleset / "2026-10-20_14-34-00"
            bad.mkdir()
            (bad / "Not-A-Slug.lisp").write_bytes(b"abc")
            with self.assertRaises(VersionError) as caught:
                versions_in(root, "hello-world", ruleset)
            self.assertIn("title slug", str(caught.exception))


if __name__ == "__main__":
    unittest.main()

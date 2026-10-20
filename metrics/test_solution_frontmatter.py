#!/usr/bin/env python3
"""In-file title and author blocks, and the title slug."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from solution_frontmatter import (  # noqa: E402
    PREFIX_BY_EXTENSION,
    SolutionFrontmatterError,
    render,
    slugify,
    split_solution,
)


class SolutionFrontmatterTest(unittest.TestCase):
    def test_slug_is_lowercase_ascii_with_single_hyphens(self) -> None:
        self.assertEqual(slugify("Loop with mod 15"), "loop-with-mod-15")
        self.assertEqual(slugify("Hard-coded lines"), "hard-coded-lines")
        self.assertEqual(slugify("  Mod 400, 4, and 100  "), "mod-400-4-and-100")
        self.assertEqual(slugify("---Hello---"), "hello")

    def test_each_comment_syntax_reads_title_and_optional_author(self) -> None:
        bodies = {
            "thue": b"^a ::= b\n::=\na\n",
            "lisp": b"(add 1 2)\n",
            "fth": b"1 2 +\n",
            "bas": b'PRINT "Hi"\n',
            "expr": b"let x = 1; x\n",
        }
        for extension, body in bodies.items():
            prefix = PREFIX_BY_EXTENSION[extension]
            both = render(prefix, {"title": "Add", "author": "Ada <ada@example.com>"}, body)
            fields, code = split_solution(both, extension)
            self.assertEqual(fields["title"], "Add")
            self.assertEqual(fields["author"], "Ada <ada@example.com>")
            self.assertEqual(code, body)
            title_only = render(prefix, {"title": "Add"}, body)
            fields, code = split_solution(title_only, extension)
            self.assertEqual(fields, {"title": "Add"})
            self.assertEqual(code, body)
            self.assertEqual(split_solution(body, extension), ({}, body))

    def test_missing_title_unknown_key_and_colon_colon_are_rejected(self) -> None:
        for extension, prefix in PREFIX_BY_EXTENSION.items():
            missing = f"{prefix}---\n{prefix}author: Ada\n{prefix}---\ncode\n".encode()
            fields, _code = split_solution(missing, extension)
            self.assertNotIn("title", fields)
            unknown = f"{prefix}---\n{prefix}title: Add\n{prefix}limits: 1\n{prefix}---\ncode\n".encode()
            with self.assertRaises(SolutionFrontmatterError):
                split_solution(unknown, extension)
            bad = f"{prefix}---\n{prefix}title: foo::bar\n{prefix}---\ncode\n".encode()
            with self.assertRaises(SolutionFrontmatterError) as caught:
                split_solution(bad, extension)
            self.assertIn("::", str(caught.exception))

    def test_nested_value_is_rejected(self) -> None:
        text = b"---\ntitle: Add\nauthor: {name: Ada}\n---\ncode\n"
        with self.assertRaises(SolutionFrontmatterError):
            split_solution(text, "thue")

    def test_bytes_without_a_block_stay_exact(self) -> None:
        data = "café\n".encode()
        self.assertEqual(split_solution(data, "thue"), ({}, data))


if __name__ == "__main__":
    unittest.main()

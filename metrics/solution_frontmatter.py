"""Title and author block at the top of a solution file.

Direct Thue uses plain comment lines. Lisp, Forth, BASIC, and Expr use that
language's comment prefix. The subset matches metrics/frontmatter.py: one
`key: value` per line, no nesting. `title` is required by the version
validator. `author` is optional. The file name is `slugify(title)` plus the
extension.
"""

from __future__ import annotations

import re

from frontmatter import FrontmatterError, parse_field_content

SOLUTION_KEYS = frozenset({"title", "author"})
PREFIX_BY_EXTENSION = {
    "thue": "",
    "lisp": "; ",
    "fth": "\\ ",
    "bas": "REM ",
    "expr": "// ",
}
_SNIFF_ORDER = ("expr", "lisp", "fth", "bas", "thue")
_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class SolutionFrontmatterError(ValueError):
    pass


def slugify(title: str) -> str:
    """Lowercase ASCII. Runs of non-alphanumerics become one hyphen."""
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    if _SLUG_RE.fullmatch(slug) is None:
        raise SolutionFrontmatterError(f"title {title!r} has an empty slug")
    return slug


def split_solution(data: bytes, extension: str | None = None) -> tuple[dict[str, str], bytes]:
    """Return the leading fields and the bytes after the block.

    No leading block returns empty fields and the original bytes. A block
    that starts and is not valid raises.
    """
    prefix = _matching_prefix(data, extension)
    if prefix is None:
        return {}, data
    return _parse_block(data, prefix)


def render(prefix: str, fields: dict[str, str], body: bytes) -> bytes:
    lines = [f"{prefix}---"]
    for key in ("title", "author"):
        value = fields.get(key, "")
        if not value:
            continue
        content = f"{key}: {value}"
        if "::" in content or key not in SOLUTION_KEYS:
            raise SolutionFrontmatterError(f"front matter field {content!r} is not allowed")
        lines.append(prefix + content)
    lines.append(f"{prefix}---")
    return ("\n".join(lines) + "\n").encode("utf-8") + body


def _opener(prefix: str) -> bytes:
    return f"{prefix}---\n".encode("ascii")


def _closer(prefix: str) -> bytes:
    return f"{prefix}---".encode("ascii")


def _matching_prefix(data: bytes, extension: str | None) -> str | None:
    if extension is not None:
        if extension not in PREFIX_BY_EXTENSION:
            return None
        prefix = PREFIX_BY_EXTENSION[extension]
        if data.startswith(_opener(prefix)):
            return prefix
        return None
    for ext in _SNIFF_ORDER:
        prefix = PREFIX_BY_EXTENSION[ext]
        if data.startswith(_opener(prefix)):
            return prefix
    return None


def _parse_block(data: bytes, prefix: str) -> tuple[dict[str, str], bytes]:
    opener = _opener(prefix)
    closer = _closer(prefix)
    offset = len(opener)
    raw_lines: list[bytes] = []
    while True:
        newline = data.find(b"\n", offset)
        if newline < 0:
            if data[offset:] == closer:
                return _fields(raw_lines, prefix), b""
            raise SolutionFrontmatterError("front matter is not closed")
        line = data[offset:newline]
        if line == closer:
            return _fields(raw_lines, prefix), data[newline + 1 :]
        raw_lines.append(line)
        offset = newline + 1


def _fields(lines: list[bytes], prefix: str) -> dict[str, str]:
    pre = prefix.encode("ascii")
    fields: dict[str, str] = {}
    for raw in lines:
        if not raw.startswith(pre):
            raise SolutionFrontmatterError(f"front matter line {raw!r} is not a comment")
        content = raw[len(pre) :].decode("utf-8")
        if "::" in content:
            raise SolutionFrontmatterError("front matter value contains '::'")
        if content == "":
            continue
        try:
            key, value = parse_field_content(content, "solution")
        except FrontmatterError as exc:
            raise SolutionFrontmatterError(str(exc)) from exc
        if key not in SOLUTION_KEYS:
            raise SolutionFrontmatterError(f"unknown front matter key {key!r}")
        if key in fields:
            raise SolutionFrontmatterError(f"front matter key {key!r} must be a new non-empty field")
        fields[key] = value
    return fields

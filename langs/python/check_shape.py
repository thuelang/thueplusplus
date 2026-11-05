#!/usr/bin/env python3
"""Compare Python reader dumps with the CPython ast shape for this slice."""

from __future__ import annotations

import ast
import subprocess
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CASE_DIR = Path(__file__).resolve().parent / "cases"
PROGRAM = Path(__file__).resolve().parent / "python.thue"
REQUIRED = (
    "1+2",
    "(a+b)*c",
    '"hi"',
    "a",
    "pass",
    "a = 1\nb = 2",
    "def f():\n    pass\n",
    "f(1)",
    "a and b",
    "return",
)


def call_shape(node: ast.AST):
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.List):
        return tuple(call_shape(item) for item in node.elts)
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
        return (
            node.func.id,
            tuple(call_shape(arg) for arg in node.args),
            tuple((kw.arg, call_shape(kw.value)) for kw in node.keywords),
        )
    raise AssertionError(f"dump has an unexpected node: {ast.dump(node)}")


def real_shape(node):
    if isinstance(node, (ast.operator, ast.unaryop, ast.cmpop, ast.boolop, ast.expr_context)):
        return (type(node).__name__, (), ())
    if isinstance(node, ast.Constant):
        return ("Constant", (), (("value", node.value),))
    if isinstance(node, ast.Name):
        return ("Name", (), (("id", node.id), ("ctx", real_shape(node.ctx))))
    if isinstance(node, ast.BinOp):
        return (
            "BinOp",
            (),
            (("left", real_shape(node.left)), ("op", real_shape(node.op)), ("right", real_shape(node.right))),
        )
    if isinstance(node, ast.UnaryOp):
        return ("UnaryOp", (), (("op", real_shape(node.op)), ("operand", real_shape(node.operand))))
    if isinstance(node, ast.BoolOp):
        return (
            "BoolOp",
            (),
            (("op", real_shape(node.op)), ("values", tuple(real_shape(item) for item in node.values))),
        )
    if isinstance(node, ast.Call):
        return (
            "Call",
            (),
            (
                ("func", real_shape(node.func)),
                ("args", tuple(real_shape(item) for item in node.args)),
                ("keywords", tuple(real_shape(item) for item in node.keywords)),
            ),
        )
    if isinstance(node, ast.Compare):
        return (
            "Compare",
            (),
            (
                ("left", real_shape(node.left)),
                ("ops", tuple(real_shape(op) for op in node.ops)),
                ("comparators", tuple(real_shape(item) for item in node.comparators)),
            ),
        )
    if isinstance(node, ast.Pass):
        return ("Pass", (), ())
    if isinstance(node, ast.Return):
        if node.value is None:
            return ("Return", (), ())
        return ("Return", (), (("value", real_shape(node.value)),))
    if isinstance(node, ast.arg):
        return ("arg", (), (("arg", node.arg),))
    if isinstance(node, ast.arguments):
        return (
            "arguments",
            (),
            (
                ("posonlyargs", tuple(real_shape(item) for item in node.posonlyargs)),
                ("args", tuple(real_shape(item) for item in node.args)),
                ("kwonlyargs", tuple(real_shape(item) for item in node.kwonlyargs)),
                ("kw_defaults", tuple(real_shape(item) for item in node.kw_defaults if item is not None)),
                ("defaults", tuple(real_shape(item) for item in node.defaults)),
            ),
        )
    if isinstance(node, ast.FunctionDef):
        return (
            "FunctionDef",
            (),
            (
                ("name", node.name),
                ("args", real_shape(node.args)),
                ("body", tuple(real_shape(item) for item in node.body)),
                ("decorator_list", tuple(real_shape(item) for item in node.decorator_list)),
                ("type_params", tuple(real_shape(item) for item in node.type_params)),
            ),
        )
    if isinstance(node, ast.Assign):
        return (
            "Assign",
            (),
            (
                ("targets", tuple(real_shape(item) for item in node.targets)),
                ("value", real_shape(node.value)),
            ),
        )
    if isinstance(node, ast.If):
        return (
            "If",
            (),
            (
                ("test", real_shape(node.test)),
                ("body", tuple(real_shape(item) for item in node.body)),
                ("orelse", tuple(real_shape(item) for item in node.orelse)),
            ),
        )
    if isinstance(node, ast.Expr):
        return ("Expr", (), (("value", real_shape(node.value)),))
    if isinstance(node, ast.Module):
        return (
            "Module",
            (),
            (
                ("body", tuple(real_shape(item) for item in node.body)),
                ("type_ignores", tuple(real_shape(item) for item in node.type_ignores)),
            ),
        )
    raise AssertionError(f"unexpected CPython node {type(node).__name__}")


def run(source: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["uv", "run", "thue", str(PROGRAM), f"--input={source}", "--max-evals", "3000000", "--max-steps", "200000"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


def main() -> int:
    manifests = sorted(CASE_DIR.glob("*.toml"))
    cases = []
    for path in manifests:
        cases.extend(tomllib.loads(path.read_text(encoding="utf-8"))["case"])
    inputs = [case["input"] for case in cases]
    missing = [item for item in REQUIRED if item not in inputs]
    if missing:
        print("missing required inputs: " + ", ".join(missing), file=sys.stderr)
        return 1
    for case in cases:
        source = case["input"]
        result = run(source)
        expect = case["expect"]
        if result.returncode != expect["exit_code"] or result.stdout != expect["stdout"] or result.stderr != expect["stderr"]:
            print(f"{case['name']} drifted", file=sys.stderr)
            print("stdout", repr(result.stdout), file=sys.stderr)
            print("stderr", repr(result.stderr), file=sys.stderr)
            return 1
        if result.returncode != 0:
            continue
        try:
            parsed = ast.parse(source)
        except SyntaxError:
            if source == "007" and "Constant(value=007)" not in result.stdout:
                print("leading zeros were not kept", file=sys.stderr)
                return 1
            continue
        got = call_shape(ast.parse(result.stdout.strip(), mode="eval").body)
        want = real_shape(parsed)
        if got != want:
            print(f"{case['name']} shape differs", file=sys.stderr)
            print(got, file=sys.stderr)
            print(want, file=sys.stderr)
            return 1
    print("shape ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())

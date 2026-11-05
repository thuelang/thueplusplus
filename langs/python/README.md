---
name: Python
description: A reader that turns a small Python program into an AST dump.
extension: py
---

# Python

`python.thue` reads a small Python program and writes an AST dump. It does not run the program. There is no environment, no call, and no arithmetic. `1/0` is a division node, not an error.

```bash
uv run thue langs/python/python.thue --input '1+2'
```

The input is the whole program.

## Dump

Stdout is one line, the same shape as `ast.parse` for this slice, plus a newline. Offsets are omitted. `type_ignores` is always empty. A name in an expression is loaded. A name on the left of `=` is stored.

```text
Module(body=[Expr(value=BinOp(left=Constant(value=1), op=Add(), right=Constant(value=2)))], type_ignores=[])
```

```text
Module(body=[If(test=Name(id='a', ctx=Load()), body=[Pass()], orelse=[Pass()])], type_ignores=[])
```

| Source | Node |
| --- | --- |
| `1`, `1.5`, `007` | `Constant(value=...)` in source spelling |
| `True`, `False`, `None` | `Constant(value=True)`, `False`, or `None` |
| `"hi"` or `'hi'` | `Constant(value="hi")` |
| `a` | `Name(id='a', ctx=Load())` |
| `1+2` | `BinOp` with `Add`, `Sub`, `Mult`, or `Div` |
| `-1`, `+1` | `UnaryOp` with `USub` or `UAdd` |
| `1<2` | `Compare` with one op and one comparator |
| `pass` | `Pass()` |
| `a = 1` | `Assign` with one `Name` target in `Store` |
| `if` / `else` / `elif` | `If`. An `elif` is a nested `If` in `orelse` |

String constants are always double quoted. The escape spelling is `\\`, `\"`, `\n`, `\t`, `\r`, `\b`, and `\f`. A name is single quoted. Operators are `Add`, `Sub`, `Mult`, `Div`, `UAdd`, `USub`, `Eq`, `NotEq`, `Lt`, `LtE`, `Gt`, and `GtE`.

`007` stays `007`. CPython rejects that spelling. `1/2` is division, not a fraction. `1e2`, `1.`, and `.5` are outside the repository numeric spelling and fail.

## Lines and indent

A newline ends a statement. Blank lines are skipped. A newline inside `()` is whitespace. A newline that appears while an operator still needs a value is also whitespace, so `1+\n2` stays one sum. CPython rejects that spelling.

Indent is the spaces after a newline. The first line's leading spaces are not indent, so ` -(1+2)` is still a negation. A later line must land on an indent the stack already holds, or one step deeper for a suite.

A tab is rejected, including a tab used as indent and a tab between tokens. A tab inside a quoted string is a character of that string. This slice does not expand tabs.

A suite is a newline and a deeper indent. `if a:\n  pass` is a suite. `if a: pass` on one line is a syntax error.

## What this slice reads

- integers `[0-9]+` and decimals `[0-9]+\.[0-9]+`
- names `[A-Za-z_][A-Za-z0-9_]*`
- double and single quoted strings
- `+` `-` `*` `/`, unary `+` and `-`, and parentheses
- `==` `!=` `<` `<=` `>` `>=`, one comparison
- `True`, `False`, and `None`
- `pass`
- `name = expression`, one target
- `if` / `else` / `elif`

A string escape is the same set as the Lisp reader: `\\` `\"` `\n` `\t` `\r` `\b` `\f`. `\'` is not an escape. `f"..."`, `r"..."`, `b"..."`, and triple quotes are rejected. `match`, `case`, and `type` are rejected even as names.

## Errors

Stderr is one name and a newline. The exit code is 2. Stdout is empty.

| Name | When |
| --- | --- |
| `syntax_error` | The program is empty, a token is missing, a parenthesis or quote is not closed, two values sit side by side, or an indent does not match the stack. |
| `invalid_string_escape` | A backslash in a string is not one of the supported escapes. |
| `unsupported_form` | The source uses a tab, a call, an attribute, `def`, `return`, a boolean operator, a chained assignment, or another form this slice does not read. |

## Later

Calls, `def`, `return`, and boolean operators are the next slice. They fail here.

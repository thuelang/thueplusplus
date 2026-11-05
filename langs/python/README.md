---
name: Python
description: A reader that turns one Python expression into an AST dump.
extension: py
---

# Python

`python.thue` reads one Python expression and writes an AST dump. It does not run the program. There is no environment, no call, and no arithmetic. `1/0` is a division node, not an error.

```bash
uv run thue langs/python/python.thue --input '1+2'
```

The input is the whole program. A newline inside the expression is whitespace. A second value, or a statement, is an error.

## Dump

Stdout is one line, the same shape as `ast.parse` for this slice, plus a newline. Offsets are omitted. `type_ignores` is always empty. Every name is loaded.

```text
Module(body=[Expr(value=BinOp(left=Constant(value=1), op=Add(), right=Constant(value=2)))], type_ignores=[])
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

String constants are always double quoted. The escape spelling is `\\`, `\"`, `\n`, `\t`, `\r`, `\b`, and `\f`. A name is single quoted. Operators are `Add`, `Sub`, `Mult`, `Div`, `UAdd`, `USub`, `Eq`, `NotEq`, `Lt`, `LtE`, `Gt`, and `GtE`.

`007` stays `007`. CPython rejects that spelling. `1/2` is division, not a fraction. `1e2`, `1.`, and `.5` are outside the repository numeric spelling and fail.

## What this slice reads

- integers `[0-9]+` and decimals `[0-9]+\.[0-9]+`
- names `[A-Za-z_][A-Za-z0-9_]*`
- double and single quoted strings
- `+` `-` `*` `/`, unary `+` and `-`, and parentheses
- `==` `!=` `<` `<=` `>` `>=`, one comparison
- `True`, `False`, and `None`

A string escape is the same set as the Lisp reader: `\\` `\"` `\n` `\t` `\r` `\b` `\f`. `\'` is not an escape. `f"..."`, `r"..."`, `b"..."`, and triple quotes are rejected. `match`, `case`, and `type` are rejected even as names.

## Errors

Stderr is one name and a newline. The exit code is 2. Stdout is empty.

| Name | When |
| --- | --- |
| `syntax_error` | The expression is empty, a token is missing, a parenthesis or quote is not closed, or two values sit side by side. |
| `invalid_string_escape` | A backslash in a string is not one of the supported escapes. |
| `unsupported_form` | The source is a statement, a call, an attribute, a chain of comparisons, or another form this slice does not read. |

## Later

Indentation, statements, calls, and boolean operators are later slices. They fail here.

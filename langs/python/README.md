---
name: Python
description: A reader that turns a small Python program into an AST dump.
extension: py
---

# Python

`python.thue` reads a small Python program and writes an AST dump. It does not run the program. There is no environment and no arithmetic. A call is a `Call` node. `1/0` is a division node, not an error.

```bash
uv run thue langs/python/python.thue --input '1+2'
```

The input is the whole program. Only source that `ruff format` would emit for this slice is required: 4-space indents, a suite on the next line, and no tabs. Supporting another layout is fine but not required. A layout ruff would rewrite is outside the contract.

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
| `a and b`, `a or b` | `BoolOp` with `And` or `Or`. The same operator in a row is one `BoolOp`. Parentheses keep a nested `BoolOp` |
| `not a` | `UnaryOp` with `Not` |
| `f(1, 2)` | `Call` with positional `args` and `keywords=[]` |
| `pass` | `Pass()` |
| `a = 1` | `Assign` with one `Name` target in `Store` |
| `if` / `else` / `elif` | `If`. An `elif` is a nested `If` in `orelse` |
| `return` | `Return()` |
| `return 1` | `Return(value=...)` |
| `def f(a):` | `FunctionDef` with `decorator_list=[]` and `type_params=[]` |

String constants are always double quoted. The escape spelling is `\\`, `\"`, `\n`, `\t`, `\r`, `\b`, and `\f`. A name is single quoted. Operators are `Add`, `Sub`, `Mult`, `Div`, `UAdd`, `USub`, `Not`, `Eq`, `NotEq`, `Lt`, `LtE`, `Gt`, `GtE`, `And`, and `Or`.

`007` stays `007`. CPython rejects that spelling. `1/2` is division, not a fraction. `1e2`, `1.`, and `.5` are outside the repository numeric spelling and fail.

## Lines and indent

Ruff format is the supported surface. For the forms this slice reads, that is a newline between statements and a suite indented by four spaces:

```text
if a:
    pass
else:
    pass
```

`ruff format` turns a tab into spaces. This reader does not. A tab in the source, including a tab used as indent or between tokens, is `unsupported_form`. A tab inside a quoted string is a character of that string.

A suite is the newline and the four-space indent above. `if a: pass` on one line is a syntax error. `def f(): pass` on one line is a syntax error. An indent that does not match an outer level is a syntax error.

A newline inside `()` is whitespace. A newline that appears while an operator still needs a value is also whitespace, so `1+\n2` stays one sum. CPython rejects that spelling. Spaces before the first token of the file are not indent, so ` -(1+2)` is still a negation. Those two spellings are not what ruff emits.

## What this slice reads

- integers `[0-9]+` and decimals `[0-9]+\.[0-9]+`
- names `[A-Za-z_][A-Za-z0-9_]*`
- double and single quoted strings
- `+` `-` `*` `/`, unary `+` and `-`, and parentheses
- `==` `!=` `<` `<=` `>` `>=`, one comparison
- `True`, `False`, and `None`
- `and`, `or`, and `not`
- `f(...)` with positional arguments
- `pass`
- `name = expression`, one target
- `if` / `else` / `elif`
- `return` and `return` expression
- `def name(params):` and an indented suite

A parameter is a simple name. Names are separated by commas, and a trailing comma is accepted. A default, an annotation, `*args`, `**kwargs`, `/`, and a bare `*` are `unsupported_form`. A keyword argument in a call is `unsupported_form`.

`not` sits below a comparison and above `and`. `and` sits above `or`. `not` after `+`, a comparison, or unary minus is a syntax error. `not a == b` is `not` applied to the comparison.

A string escape is the same set as the Lisp reader: `\\` `\"` `\n` `\t` `\r` `\b` `\f`. `\'` is not an escape. `f"..."`, `r"..."`, `b"..."`, and triple quotes are rejected. `match`, `case`, and `type` are rejected even as names.

## Errors

Stderr is one name and a newline. The exit code is 2. Stdout is empty.

| Name | When |
| --- | --- |
| `syntax_error` | The program is empty, a token is missing, a parenthesis or quote is not closed, two values sit side by side, an indent does not match the stack, or `not` appears where a tighter expression is required. |
| `invalid_string_escape` | A backslash in a string is not one of the supported escapes. |
| `unsupported_form` | The source uses a tab, an attribute, a class, a decorator, a lambda, an import, `async`, a comprehension, a chained assignment, a default or annotation, `*args`, or another form this slice does not read. |

## Later

Classes, decorators, imports, loops, comprehensions, `async`, lambdas, and f-strings fail here. The reader still does not run the program.

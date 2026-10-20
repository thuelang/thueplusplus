---
name: Expr
description: An expr-lang interpreter for everyday arithmetic, comparisons, booleans, and env lookups.
extension: expr
---

# Expr

`expr.thue` evaluates one [expr-lang](https://github.com/expr-lang/expr) expression. Phases 0 and 1 only: arithmetic, comparisons, booleans, ternary, `??`, and environment lookup. The program is Thue++ rules. It reads two line resources and writes JSON to stdout.

## Resources

| Resource | Role |
| --- | --- |
| `expr` | The expression, one line. |
| `env` | A JSON object of names. An empty line is an empty environment. |
| `stdout` | The JSON value plus a newline. |
| `stderr` | An error message. Exit code 2. |

Bind both lines on the command line:

```
thue langs/expr/expr.thue --line:expr 'foo + 1' --line:env '{"foo":2}'
```

A direct run has to pass `--line:env`. An empty line and `{}` are both an empty environment. The example runner supplies an empty `env` line when a manifest omits `lines.env`.

`env` accepts a JSON object. Nested arrays and empty objects are returned as JSON. Numbers, strings, `true`, `false`, and `null` are ordinary values. A non-object value such as `[]` or `1` is `invalid_env: expected JSON object`.

Problem solutions are the expression itself on `--input`, and they read `stdin` from `env`. The metrics runner passes `--line:env` with `{"stdin":"..."}`, the problem's stdin lines joined by newlines and with no extra trailing newline. A number, bool, or null result is still JSON plus a newline. A string result is the text plus one newline, not a JSON string.

## What works

- Integers, `+` `-` `*` `%`, parentheses, unary `+` and `-`.
- `/` (a float), `**` and `^` with an integer exponent.
- `true`, `false`, `nil`.
- `==` `!=` `<` `>` `<=` `>=`, including chains such as `1 < 2 < 3`.
- `!` and `not`. `&&` and `and`. `||` and `or`. These three are lazy.
- Ternary `? :`, elvis `?:`, and `??`.
- Decimal, hex (`0x`), octal (`0o`), and binary (`0b`) integers, plus ordinary floats (`1.5`, `1e2`).
- A float stays an exact rational until output. Output rounds it to the nearest float64 and prints Go's shortest JSON form: `1/3` is `0.3333333333333333`, `2/3` is `0.6666666666666666`, `10/3` is `3.3333333333333335`. Magnitudes below `1e-6` or at least `1e21` use exponent form (`1e-7`, `1e+21`). A magnitude past float64 is `unsupported_float: overflow`.
- Names looked up in `env`. An unknown name is an error.
- String literals and `+` on strings. Escapes are `\"` `\\` `\/` `\b` `\f` `\n` `\r` `\t` and `\u` of a code point at or below U+007F.
- `let name = value; body` as a top-level sequence. The body can be another `let`.
- `//` comments out the rest of a line.
- `a..b` builds an inclusive integer range. `map`, `reduce`, and `join` walk arrays. `split` cuts a string. `int` and `string` convert. `array[index]` reads one element. `#` is the element and `#acc` is the accumulator, and both are legal only inside a predicate.

## Errors

Stderr is a short code, or `code: plain words` when the extra words are cheap. There is no character position. The text does not try to match expr's Go wording. Exit code is 2.

| Message | When |
| --- | --- |
| `syntax_error: unexpected ')'` | A `)` does not close an open `(`. |
| `syntax_error: unclosed '('` | A `(` is never closed. |
| `syntax_error: empty expression` | The line is empty. |
| `syntax_error: missing value` | An operator has no operand. |
| `syntax_error: unexpected ':'` | A `:` has no `?`. |
| `syntax_error: unexpected 'and'` / `'or'` | `and` or `or` sits where a value is required. |
| `syntax_error: unexpected name` | A name sits where an operator is required. |
| `syntax_error: unexpected token` | Any other token the grammar does not accept. |
| `syntax_error: unclosed comment` | A `/*` comment never ends. |
| `syntax_error: bad hex literal` / `bad binary literal` / `bad octal literal` | `0x`, `0b`, or `0o` has no digits. |
| `syntax_error: integer out of range` | An integer literal does not fit in int64. |
| `syntax_error: '??' cannot mix with that operator` | `??` is followed by a different operator without parentheses. |
| `unknown_name: foo` | `foo` is not in `env`. |
| `type_error: cannot add bool and int` | The operands of `+` `-` `*` `/` `%` `**` or a comparison have different types. The verb matches the operator. |
| `type_error: cannot apply not to int` | `!` or `not` is applied to a non-bool. |
| `type_error: cannot apply unary plus to bool` | Unary `+` is applied to a non-number. |
| `type_error: cannot negate nil` | Unary `-` is applied to a non-number. |
| `type_error: condition must be a bool` | `&&`, `or`, `?:`, or ternary has a non-bool condition. |
| `type_error: exponent must be an integer` | `**` or `^` has a non-integer exponent. |
| `division_by_zero` | `/` or `%` by zero, or a negative power of zero, when that operation actually runs. |
| `unsupported_float: overflow` | A float magnitude does not fit in float64. |
| `invalid_env: expected JSON object` | `env` is not a JSON object. |
| `invalid_json: malformed JSON` | The object is not valid JSON. |
| `invalid_json: nested object members are unsupported` | A nested object has fields. Empty nested objects are fine. |
| `invalid_json: strings inside arrays are unsupported` | An array element is a string. |
| `syntax_error: bad string escape` | A string escape is not one of the supported forms, or `\u` is above U+007F. |
| `syntax_error: unclosed string` | A `"` never closes. |
| `syntax_error: '#' outside a predicate` | `#` is used outside `map` or `reduce`. |
| `syntax_error: '#acc' outside a predicate` | `#acc` is used outside `reduce`. |
| `syntax_error: unexpected ']'` | A `]` does not close an index. |
| `syntax_error: unexpected '['` | A `[` sits where an operator is required. |
| `type_error: unknown function NAME` | The call is not `int`, `string`, `map`, `join`, `split`, or `reduce`. |
| `type_error: bad index` | The index is negative or past the end. |
| `type_error: range needs integers` | `..` has a non-integer endpoint. |
| `type_error: cannot convert string` | `int` is given a string that is not an integer. |
| `type_error: cannot convert value` | `int` or `string` is given a value it does not convert. |
| `type_error: wrong arity` | `map`, `join`, `split`, or `reduce` has the wrong number of arguments. |
| `type_error: empty separator` | `split` is given an empty separator. |
| `type_error: cannot join that` | `join` sees a non-string element. |
| `type_error: cannot print array` | The result is an array. |
| `type_error: cannot map that` | `map` is given a non-array. |
| `type_error: cannot reduce that` | `reduce` is given a non-array or a bad element. |
| `type_error: cannot split that` | `split` is given a non-string. |

## Known differences

These are intentional. The curated cases stay on everyday expressions. The wider Go-only score lists the same buckets as excluded.

- Evaluated division or modulo by zero is `division_by_zero`. expr produces an infinity that JSON cannot encode.
- A non-integer exponent is `type_error: exponent must be an integer`. expr uses float64 `math.Pow`.
- `0.1 + 0.2` prints `0.3`. Arithmetic stays exact, so that sum is the rational 3/10. expr rounds each operand to float64 before adding.
- An unknown name is `unknown_name`, not `nil`.
- `1 < 2 < 1/0` evaluates the division and errors. expr treats `2 < +Inf` as true and skips the failure.
- `1 ?? 2 + 3` is a syntax error. Parentheses decide the grouping: `(1 ?? 2) + 3` and `1 ?? (2 + 3)`.
- `&&`, `||`, `?:`, and `??` check the condition, then the branch they actually run. expr also resolves names and types in the branch it skips, so `false ?? foo` is an unknown-name error there and `false` here.
- int64 wrap and exotic numeric spellings are not the goal. A few literals and one wrap case are in the suite because the rules exist. Signed zero prints as `0`. Output rounds to float64. Intermediate sums such as `0.1 + 0.2` stay exact.
- `true != 0` is `type_error: cannot compare bool and int`. expr treats a bool and a number as unequal. The wider score lists these as `cross_type_compare`.
- `\u` escapes above U+007F, nested objects that have fields, and strings inside arrays are rejected.
- String literals, `let`, inclusive ranges, `map`, `reduce`, `join`, `split`, `int`, `string`, and indexing cover the shared problems. A string result is plain text plus one newline. Pipes, dates, array literals, and `filter` are out of scope.

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

## What works

- Integers, `+` `-` `*` `%`, parentheses, unary `+` and `-`.
- `/` (a float), `**` and `^` with an integer exponent.
- `true`, `false`, `nil`.
- `==` `!=` `<` `>` `<=` `>=`, including chains such as `1 < 2 < 3`.
- `!` and `not`. `&&` and `and`. `||` and `or`. These three are lazy.
- Ternary `? :`, elvis `?:`, and `??`.
- Decimal, hex (`0x`), octal (`0o`), and binary (`0b`) integers, plus ordinary floats (`1.5`, `1e2`).
- Names looked up in `env`. An unknown name is an error.

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
| `unsupported_float: non-terminating decimal` | A float does not have a finite decimal expansion. |
| `invalid_env: expected JSON object` | `env` is not a JSON object. |
| `invalid_json: malformed JSON` | The object is not valid JSON. |
| `invalid_json: nested object members are unsupported` | A nested object has fields. Empty nested objects are fine. |
| `invalid_json: strings inside arrays are unsupported` | An array element is a string. |

## Known differences

These are intentional. The curated cases stay on everyday expressions. The wider Go-only score lists the same buckets as excluded.

- Evaluated division or modulo by zero is `division_by_zero`. expr produces an infinity that JSON cannot encode.
- A non-integer exponent is `type_error: exponent must be an integer`. expr uses float64 `math.Pow`.
- A fraction whose decimal does not terminate, such as `1/3`, is `unsupported_float`.
- An unknown name is `unknown_name`, not `nil`.
- `1 < 2 < 1/0` evaluates the division and errors. expr treats `2 < +Inf` as true and skips the failure.
- `1 ?? 2 + 3` is a syntax error. Parentheses decide the grouping: `(1 ?? 2) + 3` and `1 ?? (2 + 3)`.
- `&&`, `||`, `?:`, and `??` check the condition, then the branch they actually run. expr also resolves names and types in the branch it skips, so `false ?? foo` is an unknown-name error there and `false` here.
- int64 wrap, exotic numeric spellings, and float64 rounding are not the goal. A few literals and one wrap case are in the suite because the rules exist. Signed zero prints as `0`. Do not expect bit-identical float64.
- `true != 0` is `type_error: cannot compare bool and int`. expr treats a bool and a number as unequal. The wider score lists these as `cross_type_compare`.
- `\u` escapes above U+007F, nested objects that have fields, and strings inside arrays are rejected.
- String literals, `let`, collections, predicates, pipes, and dates are out of scope.

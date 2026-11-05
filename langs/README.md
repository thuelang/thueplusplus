# Languages

`langs/<language>/` holds the current interpreter, its notes, and `cases/`.

The interpreter is one `.thue` program. `cases/` holds that language's other conformance cases, including add. Hello and factorial scripts live under `problems/<slug>/solutions/<ruleset>/`. The Go test measures the shared cases on the native Go host.

Forth, Lisp, BASIC, and Expr are the languages in this comparison. Python reads expressions, `pass`, name assignment, `if` / `else` / `elif`, `def`, `return`, calls, and `and` / `or` / `not`, and prints an AST. It does not run the program. Brainfuck stays in `examples/brainfuck/`. It is an esolang demo, not a ruleset.

`make langs` runs the shared cases. A changed interpreter must still pass, and the sum of its Go costs on the previous common problems must not go up.

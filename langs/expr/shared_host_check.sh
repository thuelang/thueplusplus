#!/bin/bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
go_thue=${THUE_GO:-/tmp/thue}
js_cli=(node "$root/js/src/cli.js")
limits=(--max-evals 3000000 --max-steps 200000)
check() {
  local input="$1"
  local env="$2"
  local go_code=0
  local js_code=0
  local go_out js_out
  go_out=$("$go_thue" "$root/langs/expr/expr.thue" --input "$input" --line:env "$env" "${limits[@]}" 2>/tmp/expr-shared-go.err) || go_code=$?
  js_out=$("${js_cli[@]}" "$root/langs/expr/expr.thue" --input "$input" --line:env "$env" "${limits[@]}" 2>/tmp/expr-shared-js.err) || js_code=$?
  local go_err js_err
  go_err=$(cat /tmp/expr-shared-go.err)
  js_err=$(cat /tmp/expr-shared-js.err)
  if [[ "$go_out" != "$js_out" || "$go_err" != "$js_err" || "$go_code" != "$js_code" ]]; then
    printf 'mismatch\n go %s %q %q\n js %s %q %q\n' "$go_code" "$go_out" "$go_err" "$js_code" "$js_out" "$js_err" >&2
    exit 1
  fi
}
read_solution() {
  python3 -c 'import pathlib,sys; print(pathlib.Path(sys.argv[1]).read_text().removesuffix("\n"), end="")' "$1"
}
check "$(read_solution "$root/problems/hello-world/solutions/expr/solution.expr")" '{"stdin":""}'
check "$(read_solution "$root/problems/factorial/solutions/expr/solution.expr")" '{"stdin":"10"}'
check "$(read_solution "$root/problems/greatest-common-divisor/solutions/expr/solution.expr")" '{"stdin":"48\n18"}'
check "$(read_solution "$root/problems/leap-year/solutions/expr/solution.expr")" '{"stdin":"2024"}'
echo js-agrees

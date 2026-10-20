#!/bin/bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
go_thue=${THUE_GO:-/tmp/thue}
js_cli=(node "$root/js/src/cli.js")
limits=(--max-evals 2000000 --max-steps 2000000)
cases=(
  '1/3'
  '2/3'
  '10/3'
  '1/7'
  '-1/3'
  '1e-7'
  '10**21'
  '1e-6'
  '1/2'
  '0.1+0.2'
  '(2**53)+1'
  '2.5**2'
  '1e309'
)
for expr in "${cases[@]}"; do
  go_out=$("$go_thue" "$root/langs/expr/expr.thue" --line:expr "$expr" --line:env '' "${limits[@]}" 2>/tmp/float-go.err) || go_code=$?
  go_code=${go_code:-0}
  js_out=$("${js_cli[@]}" "$root/langs/expr/expr.thue" --line:expr "$expr" --line:env '' "${limits[@]}" 2>/tmp/float-js.err) || js_code=$?
  js_code=${js_code:-0}
  go_err=$(cat /tmp/float-go.err)
  js_err=$(cat /tmp/float-js.err)
  if [[ "$go_out" != "$js_out" || "$go_err" != "$js_err" || "$go_code" != "$js_code" ]]; then
    printf 'mismatch %s\n go %s %q %q\n js %s %q %q\n' "$expr" "$go_code" "$go_out" "$go_err" "$js_code" "$js_out" "$js_err" >&2
    exit 1
  fi
  unset go_code js_code
done
echo js-agrees

package main

import (
	"bytes"
	"fmt"
	"os"

	"github.com/thuelang/thueplusplus/go/thuelang"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: probe phase0|phase1|env-empty|json|numbers|errors")
		os.Exit(2)
	}
	switch os.Args[1] {
	case "phase0":
		check("phase0 ok", []pair{
			{"1", "", 0, "1\n", ""},
			{"1+2*3", "", 0, "7\n", ""},
			{"(1+2)*3", "", 0, "9\n", ""},
			{"-7%3", "", 0, "-1\n", ""},
			{"--1", "", 0, "1\n", ""},
		})
	case "phase1":
		check("phase1 ok", []pair{
			{"true", "", 0, "true\n", ""},
			{"1<2<3", "", 0, "true\n", ""},
			{"!false", "", 0, "true\n", ""},
			{"false && (1/0 < 0)", "", 0, "false\n", ""},
			{"true ? 2 : 3", "", 0, "2\n", ""},
			{"nil ?? 1", "", 0, "1\n", ""},
			{"2**3", "", 0, "8\n", ""},
			{"0x10", "", 0, "16\n", ""},
			{"foo", `{"foo":1}`, 0, "1\n", ""},
		})
	case "env-empty":
		check("env-empty ok", []pair{
			{"1", "", 0, "1\n", ""},
		})
	case "json":
		check("json ok", []pair{
			{"a", `{"a":1,"b":[true,false,null]}`, 0, "1\n", ""},
			{"s", `{"s":"a\"b"}`, 0, "\"a\\\"b\"\n", ""},
			{"b", `{"b":["hi"]}`, 2, "", "invalid_json: strings inside arrays are unsupported"},
			{"n", `{"n":1.5}`, 0, "1.5\n", ""},
			{"a", `[1]`, 2, "", "invalid_env: expected JSON object"},
			{"a", `{`, 2, "", "invalid_json: malformed JSON"},
		})
	case "numbers":
		check("numbers ok", []pair{
			{"9223372036854775807+1", "", 0, "-9223372036854775808\n", ""},
			{"-7%3", "", 0, "-1\n", ""},
			{"1/2", "", 0, "0.5\n", ""},
		})
	case "errors":
		check("errors ok", []pair{
			{"foo", "", 2, "", "unknown_name: foo"},
			{")", "", 2, "", "syntax_error: unexpected ')'"},
			{"true + 1", "", 2, "", "type_error: cannot add bool and int"},
			{"1/0", "", 2, "", "division_by_zero"},
			{"a", "[]", 2, "", "invalid_env: expected JSON object"},
		})
	default:
		fmt.Fprintln(os.Stderr, "unknown probe")
		os.Exit(2)
	}
}

type pair struct {
	expr, env  string
	code       int
	out, err   string
}

func check(label string, pairs []pair) {
	for _, p := range pairs {
		code, out, errText := eval(p.expr, p.env)
		if code != p.code || out != p.out || errText != p.err {
			fmt.Fprintf(os.Stderr, "%s: %q env %q got code %d out %q err %q\n", label, p.expr, p.env, code, out, errText)
			os.Exit(1)
		}
	}
	fmt.Println(label)
}

func eval(expr, env string) (int, string, string) {
	interp := thuelang.New()
	var out, errb bytes.Buffer
	interp.Stdout = &out
	interp.Stderr = &errb
	evals, steps := 2_000_000, 2_000_000
	interp.MaxEvals = &evals
	interp.MaxSteps = &steps
	if err := interp.LoadProgram("expr/expr.thue"); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := interp.AddLineBinding("expr", expr); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := interp.AddLineBinding("env", env); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	code, err := interp.Run()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	return code, out.String(), errb.String()
}

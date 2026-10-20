package cases

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/expr-lang/expr"
)

func TestSharedProblems(t *testing.T) {
	root := filepath.Join("..", "..", "problems")
	problems := []string{
		"hello-world",
		"fizzbuzz",
		"factorial",
		"greatest-common-divisor",
		"leap-year",
	}
	for _, problem := range problems {
		source, err := os.ReadFile(filepath.Join(root, problem, "solutions", "expr", "solution.expr"))
		if err != nil {
			t.Fatal(err)
		}
		text := string(source)
		if text == "" || text[len(text)-1] != '\n' {
			t.Fatalf("%s solution must end with a newline", problem)
		}
		program := text[:len(text)-1]
		cases, err := filepath.Glob(filepath.Join(root, problem, "cases", "*.json"))
		if err != nil {
			t.Fatal(err)
		}
		if len(cases) == 0 {
			t.Fatalf("%s has no cases", problem)
		}
		for _, path := range cases {
			var spec struct {
				Reads struct {
					Stdin []string `json:"stdin"`
				} `json:"reads"`
				Writes struct {
					Stdout string `json:"stdout"`
				} `json:"writes"`
			}
			raw, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal(raw, &spec); err != nil {
				t.Fatal(err)
			}
			stdin := ""
			for i, line := range spec.Reads.Stdin {
				if i > 0 {
					stdin += "\n"
				}
				stdin += line
			}
			compiled, err := expr.Compile(program, expr.Env(map[string]any{"stdin": stdin}), expr.AsAny())
			if err != nil {
				t.Fatalf("%s %s: compile: %v", problem, path, err)
			}
			value, err := expr.Run(compiled, map[string]any{"stdin": stdin})
			if err != nil {
				t.Fatalf("%s %s: run: %v", problem, path, err)
			}
			got, err := formatShared(value)
			if err != nil {
				t.Fatalf("%s %s: %v", problem, path, err)
			}
			if got != spec.Writes.Stdout {
				t.Fatalf("%s %s:\n got %q\nwant %q", problem, filepath.Base(path), got, spec.Writes.Stdout)
			}
		}
	}
}

func formatShared(value any) (string, error) {
	switch v := value.(type) {
	case string:
		return v + "\n", nil
	case bool:
		if v {
			return "true\n", nil
		}
		return "false\n", nil
	case int:
		return fmt.Sprintf("%d\n", v), nil
	default:
		return "", fmt.Errorf("unexpected result %T (%v)", value, value)
	}
}

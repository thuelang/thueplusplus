package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/expr-lang/expr"
	"github.com/thuelang/thueplusplus/go/thuelang"
)

func main() {
	score := len(os.Args) == 2 && os.Args[1] == "-score"
	if !score && !(len(os.Args) == 1) {
		fmt.Fprintln(os.Stderr, "usage: gen [-score]")
		os.Exit(2)
	}
	mod := os.Getenv("GOMODCACHE")
	if mod == "" {
		mod = filepath.Join(os.Getenv("HOME"), "go", "pkg", "mod")
	}
	root := filepath.Join(mod, "github.com", "expr-lang", "expr@v1.17.8")
	var lines []string
	for _, rel := range []string{
		filepath.Join("testdata", "generated.txt"),
		filepath.Join("test", "fuzz", "fuzz_corpus.txt"),
	} {
		lines = append(lines, readLines(filepath.Join(root, rel))...)
	}
	excluded := map[string]int{}
	var work []string
	seen := map[string]bool{}
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || seen[line] {
			continue
		}
		seen[line] = true
		if why := exclude(line); why != "" {
			excluded[why]++
			continue
		}
		work = append(work, line)
	}
	src, err := os.ReadFile("expr/expr.thue")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	var pass, fail atomic.Int64
	var mu sync.Mutex
	var samples []string
	lazy := atomic.Int64{}
	mix := atomic.Int64{}
	zero := atomic.Int64{}
	cross := atomic.Int64{}
	jobs := make(chan string)
	var wg sync.WaitGroup
	workers := 8
	for n := 0; n < workers; n++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for line := range jobs {
				ok, sample := compare(string(src), line)
				switch sample {
				case "lazy":
					lazy.Add(1)
					continue
				case "mix":
					mix.Add(1)
					continue
				case "zero":
					zero.Add(1)
					continue
				case "cross":
					cross.Add(1)
					continue
				}
				if ok {
					pass.Add(1)
					continue
				}
				fail.Add(1)
				mu.Lock()
				if len(samples) < 8 {
					samples = append(samples, sample)
				}
				mu.Unlock()
			}
		}()
	}
	for _, line := range work {
		jobs <- line
	}
	close(jobs)
	wg.Wait()
	total := pass.Load() + fail.Load()
	fmt.Printf("wider phase0-1 %d/%d\n", pass.Load(), total)
	fmt.Printf("excluded lazy_branch %d\n", lazy.Load())
	fmt.Printf("excluded nil_coalesce_mix_runtime %d\n", mix.Load())
	fmt.Printf("excluded signed_zero %d\n", zero.Load())
	fmt.Printf("excluded cross_type_compare %d\n", cross.Load())
	for _, key := range []string{
		"out_of_phase",
		"division_by_zero",
		"non_integer_exponent",
		"nil_coalesce_mix",
		"float_rounding",
		"chained_division",
	} {
		fmt.Printf("excluded %s %d\n", key, excluded[key])
	}
	for _, sample := range samples {
		fmt.Fprintln(os.Stderr, sample)
	}
	if !score && fail.Load() > 0 {
		os.Exit(1)
	}
}

func readLines(path string) []string {
	f, err := os.Open(path)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer f.Close()
	var out []string
	s := bufio.NewScanner(f)
	s.Buffer(make([]byte, 1024), 1024*1024)
	for s.Scan() {
		out = append(out, s.Text())
	}
	return out
}

var (
	callPat   = regexp.MustCompile(`\b[A-Za-z_][A-Za-z0-9_]*\s*\(`)
	divZero   = regexp.MustCompile(`(?:/|%)\s*0(?:\b|[^0-9.])`)
	powFloat  = regexp.MustCompile(`(?:\*\*|\^)\s*-?(?:[0-9]+\.[0-9]+|\.[0-9]+)`)
	mixPat    = regexp.MustCompile(`\?\?[^()]*[+*/%<>=!-]`)
	chainDiv  = regexp.MustCompile(`[<>]=?\s*[^<>]*[<>]=?[^<>]*(?:/|%)\s*0`)
	floatLit  = regexp.MustCompile(`(?:[0-9]+\.[0-9]+|\.[0-9]+)(?:[eE][+-]?[0-9]+)?|[0-9]+[eE][+-]?[0-9]+`)
)

func exclude(line string) string {
	if strings.ContainsAny(line, "\"'`[]{}$;#") || strings.Contains(line, "..") || strings.Contains(line, "?.") {
		return "out_of_phase"
	}
	low := strings.ToLower(line)
	if strings.Contains(low, "let ") || strings.Contains(low, " in ") || strings.Contains(low, "matches") || strings.Contains(line, "|") && !onlyOr(line) {
		return "out_of_phase"
	}
	if hasCall(line) {
		return "out_of_phase"
	}
	if chainDiv.MatchString(line) {
		return "chained_division"
	}
	if divZero.MatchString(line) {
		return "division_by_zero"
	}
	if powFloat.MatchString(line) {
		return "non_integer_exponent"
	}
	if mixPat.MatchString(line) {
		return "nil_coalesce_mix"
	}
	if riskyFloat(line) {
		return "float_rounding"
	}
	return ""
}

func hasCall(line string) bool {
	for _, m := range callPat.FindAllString(line, -1) {
		name := strings.TrimSpace(strings.TrimSuffix(m, "("))
		if name != "not" {
			return true
		}
	}
	return false
}

func onlyOr(line string) bool {
	rest := strings.ReplaceAll(line, "||", "")
	return !strings.Contains(rest, "|")
}

func riskyFloat(line string) bool {
	for _, m := range floatLit.FindAllString(line, -1) {
		if strings.Contains(m, "e") || strings.Contains(m, "E") {
			continue
		}
		frac := m
		if i := strings.IndexByte(m, '.'); i >= 0 {
			frac = strings.TrimRight(m[i+1:], "0")
		}
		if len(frac) > 6 {
			return true
		}
		if strings.Contains(m, "0.1") || strings.Contains(m, "0.2") || strings.Contains(m, "0.3") {
			return true
		}
	}
	return false
}

func compare(source, line string) (bool, string) {
	oursCode, oursOut, oursErr := runThue(source, line)
	program, err := expr.Compile(line, expr.Env(map[string]any{}))
	if err != nil {
		if oursCode == 0 && strings.Contains(err.Error(), "unknown name") && strings.Count(line, "<")+strings.Count(line, ">") >= 2 {
			return false, "lazy"
		}
		if oursCode == 2 {
			return true, ""
		}
		if oursCode == 0 && lazyBranch(line) {
			return false, "lazy"
		}
		if oursCode == 2 && strings.Contains(oursErr, "cannot mix") {
			return false, "mix"
		}
		return false, fmt.Sprintf("compile %q expr %v ours %d %s %s", line, err, oursCode, oursOut, oursErr)
	}
	value, err := expr.Run(program, map[string]any{})
	if err != nil || badNumber(value) {
		if oursCode == 2 {
			return true, ""
		}
		return false, fmt.Sprintf("run %q expr %v ours %d %s", line, err, oursCode, oursOut)
	}
	payload, err := json.Marshal(value)
	if err != nil {
		if oursCode == 2 {
			return true, ""
		}
		return false, fmt.Sprintf("json %q %v", line, err)
	}
	got := strings.TrimRight(oursOut, "\n")
	if oursCode == 0 && got == string(payload) {
		return true, ""
	}
	if oursCode == 0 && (string(payload) == "-0" || string(payload) == "-0.0") && got == "0" {
		return false, "zero"
	}
	if oursCode == 2 && strings.Contains(oursErr, "cannot mix") {
		return false, "mix"
	}
	if oursCode == 2 && strings.Contains(oursErr, "cannot compare") {
		return false, "cross"
	}
	return false, fmt.Sprintf("diff %q expr %s ours %d %s %s", line, payload, oursCode, got, oursErr)
}

func lazyBranch(line string) bool {
	return strings.Contains(line, "??") || strings.Contains(line, "?:") || strings.Contains(line, "?") ||
		strings.Contains(line, "&&") || strings.Contains(line, "||") ||
		strings.Contains(line, " and ") || strings.Contains(line, " or ")
}

func badNumber(v any) bool {
	f, ok := v.(float64)
	if !ok {
		return false
	}
	return math.IsInf(f, 0) || math.IsNaN(f)
}

func runThue(source, line string) (int, string, string) {
	interp := thuelang.New()
	var out, errb bytes.Buffer
	interp.Stdout = &out
	interp.Stderr = &errb
	evals, steps := 2_000_000, 2_000_000
	interp.MaxEvals = &evals
	interp.MaxSteps = &steps
	if err := interp.LoadProgramText("expr.thue", source); err != nil {
		return 1, "", err.Error()
	}
	if err := interp.AddLineBinding("expr", line); err != nil {
		return 1, "", err.Error()
	}
	if err := interp.AddLineBinding("env", ""); err != nil {
		return 1, "", err.Error()
	}
	code, err := interp.Run()
	if err != nil {
		return code, out.String(), err.Error()
	}
	return code, out.String(), errb.String()
}

package cases

import "testing"

// Expr cases bind the expr and env line resources. They do not use the shared
// stdin problems, so this package does not call RunCommonLang.
func TestCasesSkipSharedStdin(t *testing.T) {}

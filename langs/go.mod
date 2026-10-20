module github.com/thuelang/thueplusplus/langs

go 1.24

require (
	github.com/expr-lang/expr v1.17.8
	github.com/thuelang/thueplusplus/go v0.0.0
	github.com/thuelang/thueplusplus/problems v0.0.0
)

require pgregory.net/rapid v1.2.0 // indirect

replace github.com/thuelang/thueplusplus/problems => ../problems

replace github.com/thuelang/thueplusplus/go => ../go

// Package calculator contains the pure arithmetic domain logic.
//
// It has no knowledge of HTTP or JSON so it can be tested in isolation and
// reused by any transport (REST, gRPC, CLI...).
package calculator

import (
	"errors"
	"fmt"
	"math"
	"sort"
)

// Operation identifies a supported arithmetic operation.
type Operation string

// Supported operations.
const (
	Add        Operation = "add"
	Subtract   Operation = "subtract"
	Multiply   Operation = "multiply"
	Divide     Operation = "divide"
	Power      Operation = "power"
	Sqrt       Operation = "sqrt"
	Percentage Operation = "percentage"
)

// Domain errors. Callers should compare with errors.Is.
var (
	ErrUnknownOperation = errors.New("unknown operation")
	ErrInvalidOperands  = errors.New("invalid number of operands")
	ErrDivisionByZero   = errors.New("division by zero")
	ErrNegativeSqrt     = errors.New("square root of a negative number")
	ErrNonFiniteInput   = errors.New("operands must be finite numbers")
	ErrNonFiniteResult  = errors.New("result is not a finite number")
)

// Arity is the number of operands an operation expects.
type Arity int

const (
	Unary  Arity = 1
	Binary Arity = 2
)

type definition struct {
	arity       Arity
	description string
	fn          func(x []float64) (float64, error)
}

var registry = map[Operation]definition{
	Add: {Binary, "a + b", func(x []float64) (float64, error) {
		return x[0] + x[1], nil
	}},
	Subtract: {Binary, "a - b", func(x []float64) (float64, error) {
		return x[0] - x[1], nil
	}},
	Multiply: {Binary, "a × b", func(x []float64) (float64, error) {
		return x[0] * x[1], nil
	}},
	Divide: {Binary, "a ÷ b", func(x []float64) (float64, error) {
		if x[1] == 0 {
			return 0, ErrDivisionByZero
		}
		return x[0] / x[1], nil
	}},
	Power: {Binary, "a raised to the power of b", func(x []float64) (float64, error) {
		return math.Pow(x[0], x[1]), nil
	}},
	Sqrt: {Unary, "square root of a", func(x []float64) (float64, error) {
		if x[0] < 0 {
			return 0, ErrNegativeSqrt
		}
		return math.Sqrt(x[0]), nil
	}},
	Percentage: {Binary, "a percent of b (a × b / 100)", func(x []float64) (float64, error) {
		return x[0] * x[1] / 100, nil
	}},
}

// Info describes an operation for discovery endpoints.
type Info struct {
	Name        Operation `json:"name"`
	Arity       Arity     `json:"arity"`
	Description string    `json:"description"`
}

// Operations returns every supported operation sorted by name.
func Operations() []Info {
	out := make([]Info, 0, len(registry))
	for name, def := range registry {
		out = append(out, Info{Name: name, Arity: def.arity, Description: def.description})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// ArityOf returns how many operands op expects.
func ArityOf(op Operation) (Arity, error) {
	def, ok := registry[op]
	if !ok {
		return 0, fmt.Errorf("%w: %q", ErrUnknownOperation, op)
	}
	return def.arity, nil
}

// Calculate executes op with the given operands.
//
// It guarantees that a nil error is only returned together with a finite
// result, so callers never have to deal with NaN or ±Inf (which JSON cannot
// represent anyway).
func Calculate(op Operation, operands ...float64) (float64, error) {
	def, ok := registry[op]
	if !ok {
		return 0, fmt.Errorf("%w: %q", ErrUnknownOperation, op)
	}
	if len(operands) != int(def.arity) {
		return 0, fmt.Errorf("%w: %s expects %d, got %d", ErrInvalidOperands, op, def.arity, len(operands))
	}
	for _, v := range operands {
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return 0, ErrNonFiniteInput
		}
	}

	result, err := def.fn(operands)
	if err != nil {
		return 0, err
	}
	if math.IsNaN(result) || math.IsInf(result, 0) {
		return 0, ErrNonFiniteResult
	}
	// Normalise negative zero (e.g. -0 * 5) so clients always see 0.
	if result == 0 {
		result = 0
	}
	return result, nil
}

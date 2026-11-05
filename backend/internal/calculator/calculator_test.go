package calculator

import (
	"errors"
	"math"
	"testing"
)

func TestCalculate(t *testing.T) {
	tests := []struct {
		name     string
		op       Operation
		operands []float64
		want     float64
		wantErr  error
	}{
		// Basic operations
		{"add integers", Add, []float64{2, 3}, 5, nil},
		{"add negatives", Add, []float64{-2, -3}, -5, nil},
		{"add decimals", Add, []float64{0.5, 0.25}, 0.75, nil},
		{"subtract", Subtract, []float64{10, 4}, 6, nil},
		{"subtract to negative", Subtract, []float64{4, 10}, -6, nil},
		{"multiply", Multiply, []float64{6, 7}, 42, nil},
		{"multiply by zero", Multiply, []float64{123.45, 0}, 0, nil},
		{"multiply negative zero is normalised", Multiply, []float64{-5, 0}, 0, nil},
		{"divide", Divide, []float64{10, 4}, 2.5, nil},
		{"divide negative", Divide, []float64{-9, 3}, -3, nil},
		{"divide by zero", Divide, []float64{1, 0}, 0, ErrDivisionByZero},
		{"zero divided by zero", Divide, []float64{0, 0}, 0, ErrDivisionByZero},

		// Advanced operations
		{"power", Power, []float64{2, 10}, 1024, nil},
		{"power zero exponent", Power, []float64{5, 0}, 1, nil},
		{"power negative exponent", Power, []float64{2, -1}, 0.5, nil},
		{"power fractional exponent", Power, []float64{9, 0.5}, 3, nil},
		{"power negative base fractional exponent", Power, []float64{-8, 0.5}, 0, ErrNonFiniteResult},
		{"power overflow", Power, []float64{10, 400}, 0, ErrNonFiniteResult},
		{"sqrt", Sqrt, []float64{16}, 4, nil},
		{"sqrt zero", Sqrt, []float64{0}, 0, nil},
		{"sqrt non perfect", Sqrt, []float64{2}, math.Sqrt2, nil},
		{"sqrt negative", Sqrt, []float64{-4}, 0, ErrNegativeSqrt},
		{"percentage", Percentage, []float64{15, 200}, 30, nil},
		{"percentage over 100", Percentage, []float64{150, 40}, 60, nil},

		// Edge cases
		{"multiply overflow", Multiply, []float64{math.MaxFloat64, 2}, 0, ErrNonFiniteResult},
		{"NaN input", Add, []float64{math.NaN(), 1}, 0, ErrNonFiniteInput},
		{"Inf input", Add, []float64{math.Inf(1), 1}, 0, ErrNonFiniteInput},
		{"too few operands", Add, []float64{1}, 0, ErrInvalidOperands},
		{"too many operands", Sqrt, []float64{1, 2}, 0, ErrInvalidOperands},
		{"unknown operation", Operation("modulo"), []float64{1, 2}, 0, ErrUnknownOperation},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := Calculate(tc.op, tc.operands...)

			if tc.wantErr != nil {
				if !errors.Is(err, tc.wantErr) {
					t.Fatalf("expected error %v, got %v", tc.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !almostEqual(got, tc.want) {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
			if got == 0 && math.Signbit(got) {
				t.Fatalf("expected positive zero, got negative zero")
			}
		})
	}
}

func TestArityOf(t *testing.T) {
	cases := map[Operation]Arity{
		Add: Binary, Subtract: Binary, Multiply: Binary, Divide: Binary,
		Power: Binary, Percentage: Binary, Sqrt: Unary,
	}
	for op, want := range cases {
		got, err := ArityOf(op)
		if err != nil || got != want {
			t.Errorf("ArityOf(%s) = %d, %v; want %d", op, got, err, want)
		}
	}

	if _, err := ArityOf("nope"); !errors.Is(err, ErrUnknownOperation) {
		t.Errorf("expected ErrUnknownOperation, got %v", err)
	}
}

func TestOperationsIsSortedAndComplete(t *testing.T) {
	ops := Operations()
	if len(ops) != len(registry) {
		t.Fatalf("expected %d operations, got %d", len(registry), len(ops))
	}
	for i := 1; i < len(ops); i++ {
		if ops[i-1].Name >= ops[i].Name {
			t.Fatalf("operations not sorted: %s before %s", ops[i-1].Name, ops[i].Name)
		}
	}
	for _, o := range ops {
		if o.Description == "" {
			t.Errorf("operation %s has no description", o.Name)
		}
	}
}

func almostEqual(a, b float64) bool {
	const eps = 1e-12
	return math.Abs(a-b) <= eps*math.Max(1, math.Max(math.Abs(a), math.Abs(b)))
}

// Package api exposes the calculator domain over a JSON REST interface.
package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/marciosalsa/sezzle-calculator/backend/internal/calculator"
)

// maxBodyBytes caps request bodies; a calculation payload is tiny.
const maxBodyBytes = 1 << 10 // 1 KiB

// Error codes returned in the "error.code" field. They are stable and meant
// to be switched on by clients, while "error.message" is human readable.
const (
	CodeInvalidJSON      = "INVALID_JSON"
	CodeInvalidOperand   = "INVALID_OPERAND"
	CodeUnknownOperation = "UNKNOWN_OPERATION"
	CodeDivisionByZero   = "DIVISION_BY_ZERO"
	CodeNegativeSqrt     = "NEGATIVE_SQUARE_ROOT"
	CodeResultOutOfRange = "RESULT_OUT_OF_RANGE"
	CodePayloadTooLarge  = "PAYLOAD_TOO_LARGE"
	CodeUnsupportedMedia = "UNSUPPORTED_MEDIA_TYPE"
	CodeInternal         = "INTERNAL_ERROR"
)

// CalculateRequest is the body of POST /api/v1/{operation}.
//
// Pointers are used so that a missing field can be told apart from an
// explicit zero (e.g. {"a": 0, "b": 0} is valid, {"a": 0} is not for "add").
type CalculateRequest struct {
	A *float64 `json:"a"`
	B *float64 `json:"b,omitempty"`
}

// CalculateResponse is returned on success.
type CalculateResponse struct {
	Operation calculator.Operation `json:"operation"`
	Operands  []float64            `json:"operands"`
	Result    float64              `json:"result"`
}

// ErrorBody is the payload of every non-2xx response.
type ErrorBody struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail carries a machine-readable code and a human-readable message.
type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Handler wires HTTP routes to the calculator.
type Handler struct {
	logger *slog.Logger
}

// NewHandler builds a Handler. A nil logger discards logs.
func NewHandler(logger *slog.Logger) *Handler {
	if logger == nil {
		logger = slog.New(slog.NewTextHandler(io.Discard, nil))
	}
	return &Handler{logger: logger}
}

// Routes registers all API routes on a new ServeMux.
func (h *Handler) Routes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", h.health)
	mux.HandleFunc("GET /api/v1/operations", h.listOperations)
	mux.HandleFunc("POST /api/v1/{operation}", h.calculate)
	return mux
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) listOperations(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"operations": calculator.Operations()})
}

func (h *Handler) calculate(w http.ResponseWriter, r *http.Request) {
	op := calculator.Operation(r.PathValue("operation"))

	arity, err := calculator.ArityOf(op)
	if err != nil {
		writeError(w, http.StatusNotFound, CodeUnknownOperation,
			fmt.Sprintf("operation %q is not supported", op))
		return
	}

	if ct := r.Header.Get("Content-Type"); ct != "" && !strings.HasPrefix(ct, "application/json") {
		writeError(w, http.StatusUnsupportedMediaType, CodeUnsupportedMedia,
			"Content-Type must be application/json")
		return
	}

	req, status, code, msg := decodeRequest(w, r)
	if code != "" {
		writeError(w, status, code, msg)
		return
	}

	operands, err := operandsFor(arity, req)
	if err != nil {
		writeError(w, http.StatusBadRequest, CodeInvalidOperand, err.Error())
		return
	}

	result, err := calculator.Calculate(op, operands...)
	if err != nil {
		status, code := mapDomainError(err)
		if status == http.StatusInternalServerError {
			h.logger.Error("unexpected calculator error", "operation", op, "err", err)
		}
		writeError(w, status, code, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, CalculateResponse{Operation: op, Operands: operands, Result: result})
}

// decodeRequest strictly parses the JSON body. On failure it returns a
// non-empty error code together with the HTTP status and message to send.
func decodeRequest(w http.ResponseWriter, r *http.Request) (CalculateRequest, int, string, string) {
	var req CalculateRequest

	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	dec.DisallowUnknownFields()

	if err := dec.Decode(&req); err != nil {
		var maxErr *http.MaxBytesError
		var typeErr *json.UnmarshalTypeError
		switch {
		case errors.As(err, &maxErr):
			return req, http.StatusRequestEntityTooLarge, CodePayloadTooLarge, "request body is too large"
		case errors.Is(err, io.EOF):
			return req, http.StatusBadRequest, CodeInvalidJSON, "request body is empty"
		case errors.As(err, &typeErr) && typeErr.Field == "":
			return req, http.StatusBadRequest, CodeInvalidJSON, "request body must be a JSON object"
		case errors.As(err, &typeErr):
			return req, http.StatusBadRequest, CodeInvalidOperand,
				fmt.Sprintf("field %q must be a number", typeErr.Field)
		default:
			return req, http.StatusBadRequest, CodeInvalidJSON, "request body must be valid JSON: " + err.Error()
		}
	}
	// Reject trailing data such as `{"a":1}{"a":2}`.
	if dec.More() {
		return req, http.StatusBadRequest, CodeInvalidJSON, "request body must contain a single JSON object"
	}
	return req, 0, "", ""
}

func operandsFor(arity calculator.Arity, req CalculateRequest) ([]float64, error) {
	if req.A == nil {
		return nil, errors.New(`field "a" is required`)
	}
	switch arity {
	case calculator.Unary:
		if req.B != nil {
			return nil, errors.New(`field "b" is not allowed for this operation`)
		}
		return []float64{*req.A}, nil
	default:
		if req.B == nil {
			return nil, errors.New(`field "b" is required`)
		}
		return []float64{*req.A, *req.B}, nil
	}
}

func mapDomainError(err error) (int, string) {
	switch {
	case errors.Is(err, calculator.ErrDivisionByZero):
		return http.StatusUnprocessableEntity, CodeDivisionByZero
	case errors.Is(err, calculator.ErrNegativeSqrt):
		return http.StatusUnprocessableEntity, CodeNegativeSqrt
	case errors.Is(err, calculator.ErrNonFiniteResult):
		return http.StatusUnprocessableEntity, CodeResultOutOfRange
	case errors.Is(err, calculator.ErrNonFiniteInput), errors.Is(err, calculator.ErrInvalidOperands):
		return http.StatusBadRequest, CodeInvalidOperand
	case errors.Is(err, calculator.ErrUnknownOperation):
		return http.StatusNotFound, CodeUnknownOperation
	default:
		return http.StatusInternalServerError, CodeInternal
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, ErrorBody{Error: ErrorDetail{Code: code, Message: message}})
}

package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newTestServer() http.Handler {
	return NewHandler(nil).Routes()
}

func do(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestCalculateSuccess(t *testing.T) {
	tests := []struct {
		path string
		body string
		want float64
	}{
		{"/api/v1/add", `{"a": 2, "b": 3}`, 5},
		{"/api/v1/subtract", `{"a": 2, "b": 3}`, -1},
		{"/api/v1/multiply", `{"a": 2.5, "b": 4}`, 10},
		{"/api/v1/divide", `{"a": 9, "b": 2}`, 4.5},
		{"/api/v1/divide", `{"a": 0, "b": 5}`, 0},
		{"/api/v1/power", `{"a": 2, "b": 8}`, 256},
		{"/api/v1/sqrt", `{"a": 81}`, 9},
		{"/api/v1/percentage", `{"a": 10, "b": 250}`, 25},
	}

	h := newTestServer()
	for _, tc := range tests {
		t.Run(tc.path+" "+tc.body, func(t *testing.T) {
			rec := do(t, h, http.MethodPost, tc.path, tc.body)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, body = %s", rec.Code, rec.Body)
			}
			if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
				t.Fatalf("unexpected content type %q", ct)
			}
			var resp CalculateResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("invalid JSON: %v", err)
			}
			if resp.Result != tc.want {
				t.Fatalf("result = %v, want %v", resp.Result, tc.want)
			}
		})
	}
}

func TestCalculateResponseShape(t *testing.T) {
	rec := do(t, newTestServer(), http.MethodPost, "/api/v1/add", `{"a":1,"b":2}`)
	want := `{"operation":"add","operands":[1,2],"result":3}`
	if got := strings.TrimSpace(rec.Body.String()); got != want {
		t.Fatalf("body = %s, want %s", got, want)
	}
}

func TestCalculateErrors(t *testing.T) {
	tests := []struct {
		name       string
		path       string
		body       string
		wantStatus int
		wantCode   string
	}{
		{"division by zero", "/api/v1/divide", `{"a": 1, "b": 0}`, 422, CodeDivisionByZero},
		{"negative sqrt", "/api/v1/sqrt", `{"a": -1}`, 422, CodeNegativeSqrt},
		{"overflow", "/api/v1/power", `{"a": 10, "b": 400}`, 422, CodeResultOutOfRange},
		{"unknown operation", "/api/v1/modulo", `{"a": 1, "b": 2}`, 404, CodeUnknownOperation},
		{"missing a", "/api/v1/add", `{"b": 2}`, 400, CodeInvalidOperand},
		{"missing b", "/api/v1/add", `{"a": 2}`, 400, CodeInvalidOperand},
		{"b not allowed for sqrt", "/api/v1/sqrt", `{"a": 4, "b": 2}`, 400, CodeInvalidOperand},
		{"string operand", "/api/v1/add", `{"a": "2", "b": 3}`, 400, CodeInvalidOperand},
		{"null operand", "/api/v1/add", `{"a": null, "b": 3}`, 400, CodeInvalidOperand},
		{"number out of float64 range", "/api/v1/add", `{"a": 1e400, "b": 1}`, 400, CodeInvalidOperand},
		{"unknown field", "/api/v1/add", `{"a": 1, "b": 2, "c": 3}`, 400, CodeInvalidJSON},
		{"malformed JSON", "/api/v1/add", `{"a": 1,`, 400, CodeInvalidJSON},
		{"empty body", "/api/v1/add", ``, 400, CodeInvalidJSON},
		{"array body", "/api/v1/add", `[1, 2]`, 400, CodeInvalidJSON},
		{"trailing data", "/api/v1/add", `{"a":1,"b":2}{"a":3}`, 400, CodeInvalidJSON},
		{"payload too large", "/api/v1/add", `{"a": 1, "b": 2` + strings.Repeat(" ", 2048) + `}`, 413, CodePayloadTooLarge},
	}

	h := newTestServer()
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := do(t, h, http.MethodPost, tc.path, tc.body)
			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tc.wantStatus, rec.Body)
			}
			var body ErrorBody
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("error response is not JSON: %v", err)
			}
			if body.Error.Code != tc.wantCode {
				t.Fatalf("code = %q, want %q", body.Error.Code, tc.wantCode)
			}
			if body.Error.Message == "" {
				t.Fatal("error message should not be empty")
			}
		})
	}
}

func TestCalculateRejectsNonJSONContentType(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/add", strings.NewReader(`a=1&b=2`))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()
	newTestServer().ServeHTTP(rec, req)

	if rec.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("status = %d, want 415", rec.Code)
	}
}

func TestMethodNotAllowed(t *testing.T) {
	rec := do(t, newTestServer(), http.MethodGet, "/api/v1/add", "")
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rec.Code)
	}
}

func TestListOperations(t *testing.T) {
	rec := do(t, newTestServer(), http.MethodGet, "/api/v1/operations", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var body struct {
		Operations []struct {
			Name  string `json:"name"`
			Arity int    `json:"arity"`
		} `json:"operations"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Operations) != 7 {
		t.Fatalf("expected 7 operations, got %d", len(body.Operations))
	}
}

func TestHealth(t *testing.T) {
	rec := do(t, newTestServer(), http.MethodGet, "/healthz", "")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"ok"`) {
		t.Fatalf("unexpected health response: %d %s", rec.Code, rec.Body)
	}
}

func TestMapDomainErrorDefault(t *testing.T) {
	status, code := mapDomainError(http.ErrAbortHandler)
	if status != http.StatusInternalServerError || code != CodeInternal {
		t.Fatalf("got %d %s", status, code)
	}
}

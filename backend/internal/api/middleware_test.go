package api

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

var discard = slog.New(slog.NewTextHandler(io.Discard, nil))

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})
}

func TestCORSAllowedOrigin(t *testing.T) {
	h := CORS([]string{"http://localhost:5173"})(okHandler())

	req := httptest.NewRequest(http.MethodPost, "/api/v1/add", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("allow-origin = %q", got)
	}
}

func TestCORSDisallowedOrigin(t *testing.T) {
	h := CORS([]string{"http://localhost:5173"})(okHandler())

	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.Header.Set("Origin", "http://evil.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("expected no CORS header, got %q", got)
	}
}

func TestCORSWildcardAndPreflight(t *testing.T) {
	h := CORS([]string{"*"})(okHandler())

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/add", nil)
	req.Header.Set("Origin", "http://anything.example")
	req.Header.Set("Access-Control-Request-Method", "POST")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight status = %d", rec.Code)
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "http://anything.example" {
		t.Fatal("wildcard origin not reflected")
	}
}

func TestRecover(t *testing.T) {
	panicky := http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom") })
	rec := httptest.NewRecorder()
	Recover(discard)(panicky).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if rec.Code != http.StatusInternalServerError || !strings.Contains(rec.Body.String(), CodeInternal) {
		t.Fatalf("unexpected response: %d %s", rec.Code, rec.Body)
	}
}

func TestChainOrderAndLogging(t *testing.T) {
	var order []string
	mw := func(name string) Middleware {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				order = append(order, name)
				next.ServeHTTP(w, r)
			})
		}
	}
	teapot := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
	h := Chain(teapot, mw("first"), mw("second"), Logging(discard))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	if strings.Join(order, ",") != "first,second" {
		t.Fatalf("order = %v", order)
	}
	if rec.Code != http.StatusTeapot {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestWithStaticFiles(t *testing.T) {
	dir := t.TempDir()
	must(t, os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>app</html>"), 0o644))
	must(t, os.WriteFile(filepath.Join(dir, "app.js"), []byte("console.log(1)"), 0o644))

	h := WithStaticFiles(NewHandler(nil).Routes(), dir)

	cases := []struct {
		path, wantContains string
	}{
		{"/", "app</html>"},
		{"/app.js", "console.log"},
		{"/some/client/route", "app</html>"}, // SPA fallback
		{"/healthz", `"ok"`},                 // API still reachable
	}
	for _, c := range cases {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, c.path, nil))
		if !strings.Contains(rec.Body.String(), c.wantContains) {
			t.Errorf("%s: body %q does not contain %q", c.path, rec.Body.String(), c.wantContains)
		}
	}
}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

// Command server starts the calculator REST API.
//
// Configuration (environment variables):
//
//	PORT             port to listen on (default 8080)
//	ALLOWED_ORIGINS  comma-separated CORS origins (default http://localhost:5173)
//	STATIC_DIR       if set, also serves the built frontend from this directory
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/marciosalsa/sezzle-calculator/backend/internal/api"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	port := getenv("PORT", "8080")
	origins := strings.Split(getenv("ALLOWED_ORIGINS", "http://localhost:5173"), ",")
	staticDir := os.Getenv("STATIC_DIR")

	var handler http.Handler = api.NewHandler(logger).Routes()
	if staticDir != "" {
		handler = api.WithStaticFiles(handler, staticDir)
	}
	handler = api.Chain(handler, api.Recover(logger), api.Logging(logger), api.CORS(origins))

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		logger.Info("server listening", "addr", srv.Addr, "static_dir", staticDir)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server failed", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	logger.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "err", err)
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

# Full-stack image: builds the React app and the Go API, then ships a single
# small binary that serves both the API (/api/*) and the static frontend.

# ---- 1. Frontend build --------------------------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 2. Backend build ---------------------------------------------------------
FROM golang:1.24-alpine AS backend
WORKDIR /src
COPY backend/go.mod ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# ---- 3. Runtime ---------------------------------------------------------------
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=backend /out/server /server
COPY --from=frontend /app/dist /static
ENV PORT=8080 \
    STATIC_DIR=/static
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/server"]

.PHONY: install test test-backend test-frontend coverage run-backend run-frontend build docker-build docker-run

install:
	cd frontend && npm ci

test: test-backend test-frontend

test-backend:
	cd backend && go test ./... -race -cover

test-frontend:
	cd frontend && npm test

# Regenerates the HTML reports committed under docs/coverage/
coverage:
	cd backend && go test ./... -coverprofile=coverage.out && go tool cover -func=coverage.out && go tool cover -html=coverage.out -o ../docs/coverage/backend.html
	cd frontend && npm run coverage && rm -rf ../docs/coverage/frontend && cp -r coverage ../docs/coverage/frontend

run-backend:
	cd backend && go run ./cmd/server

run-frontend:
	cd frontend && npm run dev

build:
	cd frontend && npm run build
	cd backend && go build -o bin/server ./cmd/server

docker-build:
	docker build -t sezzle-calculator .

docker-run:
	docker run --rm -p 8080:8080 sezzle-calculator

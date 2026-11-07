# AI Prompts & Workflow Log

This document details the AI prompts and incremental development process used to build this full-stack calculator application within the estimated 2–4 hour timeframe.

The task was split into modular, focused steps to ensure code quality, proper error handling, test coverage, and smooth integration between the Go backend and React frontend.

---

## 1. Architecture & Scope Planning
**Goal:** Define the repository layout and validate the step-by-step breakdown before writing code.

> *"Act as a Senior Software Engineer. I am going to build a full-stack calculator application (Go backend, React + TypeScript frontend) for a technical assessment. Here is my execution plan: 1. Setup root structure & Go backend API, 2. Build React UI & API integration, 3. Unit testing, 4. Dockerization, 5. Documentation. Evaluate this plan, point out any potential scope risks for a 2-4 hour timeframe, and suggest the ideal folder layout for the root repository."*

---

## 2. Backend Development (Go)
**Goal:** Build a modular REST API in Go using the standard library with strict input validation and clean JSON error payloads.

> *"Act as a Go specialist. Create the backend of a calculator REST API inside the `/backend` folder. Requirements: Use standard library only (`net/http`), build dedicated endpoints for each operation (add, subtract, multiply, divide, power, sqrt, percentage), implement strict input validation and error handling (e.g., division by zero, invalid input, negative square roots) returning structured JSON errors with stable codes. Keep code clean, idiomatic, and maintainable."*

---

## 3. Backend Unit Tests
**Goal:** Cover domain logic and API handlers with unit tests and generate coverage metrics.

> *"Write comprehensive unit tests in Go for the math logic and handler endpoints created in the previous step. Include tests for standard execution, edge cases (division by zero, overflow, boundary values), and invalid payloads. Provide the exact commands to run the test suite and output a coverage report (`go test -cover`)."*

---

## 4. Frontend Implementation (React + TypeScript)
**Goal:** Build a responsive, accessible React application with typed API consumption, history, keyboard support, and themes.

> *"Act as a Senior React + TypeScript Frontend Developer. In the `/frontend` folder (built with Vite), create a clean, responsive calculator UI. Requirements: Full classic calculator UX, operation chaining, keyboard shortcuts, calculation history with clear options, theme toggling (light/dark), mobile-friendly navigation, and a strongly-typed API client to communicate with the Go backend, displaying user-friendly error banners on API failure."*

---

## 5. Frontend Unit Tests
**Goal:** Ensure UI components, state logic, and API calls are thoroughly tested with Vitest and React Testing Library.

> *"Write frontend unit tests using Vitest and React Testing Library. Ensure coverage for button interactions, display updates, keyboard event handling, history state changes, and mocked backend REST API calls (including error scenarios like `DIVISION_BY_ZERO`)."*

---

## 6. Dockerization & Deployment Setup
**Goal:** Package both frontend and backend into a single, multi-stage Docker build for easy local evaluation.

> *"Create a lightweight, multi-stage `Dockerfile` and `docker-compose.yml` that compiles the Go backend and builds the static React frontend (served efficiently via Go or Nginx), packaging the entire full-stack application into a single executable image. Provide instructions on how to build and run it with one command."*

---

## 7. Documentation (README.md)
**Goal:** Produce clean technical documentation for reviewers.

> *"Write a professional `README.md` file for this repository. Include: 1. Project overview and architecture decisions, 2. Quick start / setup instructions for local development and Docker, 3. REST API documentation with request/response JSON examples, 4. How to run tests and view coverage reports for both layers."*
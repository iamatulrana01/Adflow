# ADR 001: Microservices Architecture

## Status
Accepted

## Context
AdFlow must automate advertising campaign workflows end-to-end with AI classification, high-volume ingestion, and real-time monitoring.

## Decision
Split into four services:
1. **campaign-api** (Node.js) — CRUD, orchestration, MongoDB persistence
2. **ai-classifier** (Python/FastAPI) — LLM classification and routing
3. **monitoring-service** (Node.js) — WebSocket metrics, alerting
4. **ingestion-worker** (Node.js, Lambda-compatible) — event-driven bulk ingestion

## Consequences
- Independent scaling and deployment per service
- Circuit breakers and retries required for cross-service calls
- Docker Compose for local dev; EC2 + Lambda for production

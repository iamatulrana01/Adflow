# AdFlow API Reference

## Services Overview

| Service | Base URL | Docs |
|---------|----------|------|
| Campaign API | `:3001` | This document |
| AI Classifier | `:8000` | `/docs` (Swagger) |
| Monitoring | `:3002` | WebSocket `/ws` |
| Ingestion | `:3003` | Batch + S3 events |
| Auth | `:3004` | JWT |
| Notifications | `:3005` | Alert queue |
| Analytics | `:3006` | KPIs |

---

## Auth Service (`:3004`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register `{ email, password, name }` |
| POST | `/api/auth/login` | Login → JWT token |
| GET | `/api/auth/me` | Current user (Bearer token) |
| POST | `/api/auth/verify` | Validate token |

---

## Campaign API (`:3001`)

All routes accept optional `Authorization: Bearer <token>` when `REQUIRE_AUTH=true`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health + queue stats + circuit breakers |
| GET | `/api/campaigns` | List (`?status=&failed=true`) |
| GET | `/api/campaigns/stats` | Aggregate KPIs |
| GET | `/api/campaigns/queue/stats` | Event queue stats |
| GET | `/api/campaigns/:id` | Get by ID |
| POST | `/api/campaigns` | Create (validated & sanitized) |
| POST | `/api/campaigns/:id/process` | AI classify + activate |
| POST | `/api/campaigns/:id/process?async=true` | Queue async processing |
| POST | `/api/campaigns/ingest/bulk` | Bulk ingest (max 500, concurrent) |
| POST | `/api/campaigns/ingest/async` | Queue bulk ingest |

---

## AI Classifier (`:8000`)

### POST `/classify`

**Request:**
```json
{
  "name": "Cart Abandon Retarget",
  "description": "retarget cart abandoners",
  "budget": 4000,
  "channel": "social"
}
```

**Response:**
```json
{
  "category": "retargeting",
  "priority": "high",
  "route": "queue-retargeting",
  "objective": "retention",
  "target_platform": "meta",
  "approval_flow": "manager",
  "workflow_steps": ["pixel-validation", "audience-sync", "launch"],
  "confidence": 0.91,
  "reasoning": "...",
  "provider": "mock"
}
```

---

## Monitoring (`:3002`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/metrics` | Full snapshot |
| GET | `/health/services` | All microservice health |
| WS | `/ws` | Real-time metrics stream |
| POST | `/events` | Ingest telemetry event |

---

## Notification Service (`:3005`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/notifications` | Queue alert `{ title, message, severity, channels }` |
| GET | `/api/notifications/history` | Delivery history |

---

## Analytics Service (`:3006`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/overview` | Totals, by category/channel, trends |
| GET | `/api/analytics/failures` | Failed campaigns |
| GET | `/api/analytics/performance` | API latency check |

---

## Ingestion Worker (`:3003`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ingest/batch` | Validated batch → campaign-api |
| POST | `/ingest/s3-event` | Lambda-compatible S3 event |

See [openapi.yaml](openapi.yaml) for machine-readable spec.

# AdFlow

AI-powered campaign automation and monitoring platform — microservices architecture with LLM classification (OpenAI + Anthropic Claude), real-time WebSocket dashboards, event-driven ingestion, and AWS deployment.

## Platform Capabilities

| # | Feature | Implementation |
|---|---------|----------------|
| 1 | **AI Campaign Processing** | `ai-classifier` — objective, platform, approval flow, routing |
| 2 | **Campaign Ingestion** | REST bulk API + ingestion-worker + Lambda/S3 |
| 3 | **Microservices** | 7 independent services (see below) |
| 4 | **Real-Time Dashboard** | React + WebSocket monitoring |
| 5 | **Automated Alerts** | `notification-service` — Slack + email |
| 6 | **AWS Deployment** | EC2, S3, Lambda (Terraform + deploy scripts) |
| 7 | **CI/CD** | GitHub Actions — test, build, zero-downtime deploy |
| 8 | **Fault Tolerance** | Circuit breaker + exponential backoff |
| 9 | **Automated Testing** | Jest + Pytest + E2E contracts |
| 10 | **Documentation** | OpenAPI, ADRs, deployment guide |

## Microservices

| Service | Port | Role |
|---------|------|------|
| campaign-api | 3001 | Campaign CRUD, orchestration, bulk ingest |
| ai-classifier | 8000 | OpenAI / Claude / mock LLM classification |
| monitoring-service | 3002 | WebSocket metrics, health checks, alerts |
| ingestion-worker | 3003 | Lambda-style S3/batch ingestion |
| auth-service | 3004 | JWT authentication |
| notification-service | 3005 | Slack/email notification queue |
| analytics-service | 3006 | KPIs, failures, trends |
| frontend | 5173 | React dashboard |

## Quick Start

```bash
cd adflow
cp .env.example .env
docker compose up --build
```

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Dashboard |
| http://localhost:3001/health | Campaign API |
| http://localhost:8000/docs | AI Classifier (Swagger) |
| http://localhost:3004 | Auth (admin@adflow.local / admin123) |

## AI Classification Example

Upload a campaign → AI returns:

```json
{
  "category": "retargeting",
  "objective": "retention",
  "target_platform": "meta",
  "approval_flow": "manager",
  "route": "queue-retargeting",
  "workflow_steps": ["pixel-validation", "audience-sync", "launch"]
}
```

## Run Tests

```bash
npm run install:all
npm test
cd services/ai-classifier && pytest
```

## Documentation

- [API Reference](docs/API.md)
- [OpenAPI Spec](docs/openapi.yaml)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Architecture ADRs](docs/adr/)

## License

MIT

# AdFlow Deployment Guide

## Local (Docker Compose)

```bash
cp .env.example .env
docker compose up --build
```

## AWS Production Architecture

| Component | AWS Service | Purpose |
|-----------|-------------|---------|
| Backend services | EC2 (Docker Compose) | Microservices hosting |
| Campaign files | S3 | Batch upload storage |
| Ingestion events | Lambda | S3-triggered processing |
| Database | MongoDB Atlas or EC2 | Campaign persistence |

## Zero-Downtime EC2 Deploy

1. Configure secrets in GitHub: `EC2_HOST`, `SSH_KEY`, `JWT_SECRET`, `OPENAI_API_KEY`
2. On merge to `main`, CI builds images and runs `deploy/aws/deploy.sh`
3. Rolling update: `docker compose up -d` replaces containers one-by-one

```bash
export EC2_HOST=your-ec2-ip
export SSH_KEY_PATH=~/.ssh/adflow.pem
bash deploy/aws/deploy.sh
```

## Lambda + S3 Ingestion

```bash
cd deploy/aws
terraform init
terraform apply -var="campaign_api_url=http://your-ec2:3001"
```

Upload campaign JSON to S3:

```json
{"campaigns":[{"name":"Batch Campaign","budget":5000,"channel":"social"}]}
```

## Environment Variables (Production)

| Variable | Service | Required |
|----------|---------|----------|
| `JWT_SECRET` | auth-service | Yes |
| `MONGODB_URI` | campaign-api, auth, analytics | Yes |
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | ai-classifier | Optional |
| `SLACK_WEBHOOK_URL` | notification-service | Optional |
| `ALERT_EMAIL_TO` | notification-service | Optional |
| `REQUIRE_AUTH` | campaign-api | Recommended |

## Health Endpoints

All services expose `GET /health`. Monitoring aggregates via `GET /health/services`.

## Default Admin

- Email: `admin@adflow.local`
- Password: `admin123` (change immediately in production)

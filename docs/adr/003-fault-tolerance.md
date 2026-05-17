# ADR 003: Fault Tolerance Patterns

## Status
Accepted

## Decision
Implement circuit breaker (opossum) and exponential backoff retry on all inter-service HTTP calls in campaign-api.

Monitoring service health-checks all microservices every 5 seconds and triggers notifications via notification-service on threshold breach.

## Thresholds
- Error rate > 5%
- API latency > 200ms
- Failed campaigns > 10
- Memory usage > 90%
- Any service down

## Consequences
- Temporary LLM outages degrade to mock classifier
- Cascading failures prevented by circuit open state
- Alerts deduplicated via notification queue

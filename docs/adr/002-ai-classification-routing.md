# ADR 002: AI Classification & Routing

## Status
Accepted

## Decision
Use a dedicated Python FastAPI service with pluggable LLM providers (OpenAI GPT-4o-mini, Anthropic Claude 3.5 Haiku) and a deterministic mock fallback.

Each classification returns:
- **category** — brand, performance, retargeting, experimental
- **objective** — awareness, consideration, conversion, retention, app_install
- **target_platform** — google, meta, linkedin, etc.
- **approval_flow** — auto, manager, legal, executive
- **workflow_steps** — ordered microservice processing steps
- **route** — queue name for downstream workers

## Consequences
- Campaign API remains provider-agnostic
- Mock mode enables local dev without API keys
- Legal/executive approval flows triggered by budget and regulated-industry keywords

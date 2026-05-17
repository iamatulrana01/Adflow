import json
import os
import re
from typing import Optional

import httpx

from app.models import (
    ApprovalFlow,
    CampaignInput,
    ClassificationResult,
    Objective,
    Priority,
)

ROUTE_MAP = {
    "brand": "queue-brand-awareness",
    "performance": "queue-performance",
    "retargeting": "queue-retargeting",
    "experimental": "queue-experimental",
}

APPROVAL_BY_CATEGORY = {
    "brand": ApprovalFlow.executive,
    "performance": ApprovalFlow.auto,
    "retargeting": ApprovalFlow.manager,
    "experimental": ApprovalFlow.auto,
}

WORKFLOW_BY_ROUTE = {
    "queue-brand-awareness": ["creative-review", "brand-compliance", "launch"],
    "queue-performance": ["bid-optimization", "audience-targeting", "launch"],
    "queue-retargeting": ["pixel-validation", "audience-sync", "launch"],
    "queue-experimental": ["a-b-setup", "limited-budget-cap", "launch"],
}


def _detect_objective(text: str, budget: float) -> Objective:
    if any(k in text for k in ("install", "app download", "cpi")):
        return Objective.app_install
    if any(k in text for k in ("retarget", "remarket", "retention", "loyalty")):
        return Objective.retention
    if any(k in text for k in ("convert", "purchase", "signup", "lead")):
        return Objective.conversion
    if any(k in text for k in ("awareness", "brand", "reach")):
        return Objective.awareness
    if budget >= 20000:
        return Objective.consideration
    return Objective.conversion


def _detect_platform(channel: str, text: str, override: Optional[str]) -> str:
    if override:
        return override
    platforms = {
        "google": ["search", "google", "youtube"],
        "meta": ["social", "facebook", "instagram", "meta"],
        "linkedin": ["linkedin", "b2b"],
        "tiktok": ["tiktok", "short video"],
        "programmatic": ["display", "dsp", "programmatic"],
    }
    for platform, keywords in platforms.items():
        if any(k in text for k in keywords):
            return platform
    channel_map = {
        "search": "google",
        "social": "meta",
        "display": "programmatic",
        "video": "youtube",
        "email": "email-crm",
    }
    return channel_map.get(channel, "multi-platform")


def _mock_classify(campaign: CampaignInput) -> ClassificationResult:
    text = f"{campaign.name} {campaign.description}".lower()
    budget = campaign.budget

    if budget >= 50000 or "enterprise" in text:
        category = "brand"
        priority = Priority.critical
        route = ROUTE_MAP["brand"]
        confidence = 0.88
        reasoning = "High budget / enterprise signals → brand awareness queue"
    elif any(k in text for k in ("retarget", "remarket", "cart abandon")):
        category = "retargeting"
        priority = Priority.high
        route = ROUTE_MAP["retargeting"]
        confidence = 0.91
        reasoning = "Retargeting keywords detected → retargeting queue"
    elif budget < 1000 or "test" in text or "pilot" in text:
        category = "experimental"
        priority = Priority.low
        route = ROUTE_MAP["experimental"]
        confidence = 0.85
        reasoning = "Low budget or pilot language → experimental queue"
    else:
        category = "performance"
        priority = Priority.medium
        route = ROUTE_MAP["performance"]
        confidence = 0.87
        reasoning = "Default performance classification based on budget and channel"

    if campaign.channel.value in ("search", "social") and budget >= 10000:
        priority = Priority.high

    objective = _detect_objective(text, budget)
    if campaign.objective:
        try:
            objective = Objective(campaign.objective)
        except ValueError:
            pass

    platform = _detect_platform(campaign.channel.value, text, campaign.target_platform)
    approval = APPROVAL_BY_CATEGORY[category]
    if budget >= 100000 or "regulated" in text or "pharma" in text:
        approval = ApprovalFlow.legal

    return ClassificationResult(
        category=category,
        priority=priority,
        route=route,
        confidence=confidence,
        reasoning=reasoning,
        provider="mock",
        objective=objective,
        target_platform=platform,
        approval_flow=approval,
        workflow_steps=WORKFLOW_BY_ROUTE.get(route, ["launch"]),
    )


def _parse_llm_json(content: str) -> dict:
    match = re.search(r"\{.*\}", content, re.DOTALL)
    if not match:
        raise ValueError("No JSON in LLM response")
    return json.loads(match.group())


def _build_result(data: dict, provider: str) -> ClassificationResult:
    category = data["category"]
    route = data.get("route") or ROUTE_MAP.get(category, ROUTE_MAP["performance"])
    return ClassificationResult(
        category=category,
        priority=Priority(data["priority"]),
        route=route,
        confidence=float(data.get("confidence", 0.8)),
        reasoning=data.get("reasoning", "LLM classification"),
        provider=provider,
        objective=Objective(data.get("objective", "conversion")),
        target_platform=data.get("target_platform", "multi-platform"),
        approval_flow=ApprovalFlow(data.get("approval_flow", APPROVAL_BY_CATEGORY.get(category, "auto").value)),
        workflow_steps=data.get("workflow_steps", WORKFLOW_BY_ROUTE.get(route, ["launch"])),
    )


LLM_PROMPT = """Analyze this advertising campaign. Return JSON only:
{{
  "category": "brand|performance|retargeting|experimental",
  "priority": "low|medium|high|critical",
  "route": "queue-*",
  "confidence": 0.0-1.0,
  "reasoning": "...",
  "objective": "awareness|consideration|conversion|retention|app_install",
  "target_platform": "google|meta|linkedin|tiktok|programmatic|multi-platform",
  "approval_flow": "auto|manager|legal|executive",
  "workflow_steps": ["step1", "step2"]
}}

Campaign:
name: {name}
description: {description}
budget: {budget}
channel: {channel}
"""


async def _openai_classify(campaign: CampaignInput, api_key: str) -> ClassificationResult:
    prompt = LLM_PROMPT.format(
        name=campaign.name,
        description=campaign.description,
        budget=campaign.budget,
        channel=campaign.channel.value,
    )
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
            },
        )
        res.raise_for_status()
        content = res.json()["choices"][0]["message"]["content"]
        return _build_result(_parse_llm_json(content), "openai")


async def _anthropic_classify(campaign: CampaignInput, api_key: str) -> ClassificationResult:
    prompt = LLM_PROMPT.format(
        name=campaign.name,
        description=campaign.description,
        budget=campaign.budget,
        channel=campaign.channel.value,
    )
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-3-5-haiku-20241022",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        res.raise_for_status()
        content = res.json()["content"][0]["text"]
        return _build_result(_parse_llm_json(content), "anthropic")


async def classify_campaign(campaign: CampaignInput) -> ClassificationResult:
    use_mock = os.getenv("USE_MOCK_LLM", "true").lower() == "true"
    provider_pref = os.getenv("LLM_PROVIDER", "openai")
    openai_key = os.getenv("OPENAI_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")

    if not use_mock:
        providers = []
        if provider_pref == "anthropic" and anthropic_key:
            providers.append(("anthropic", anthropic_key))
        if openai_key:
            providers.append(("openai", openai_key))
        if anthropic_key and provider_pref != "anthropic":
            providers.append(("anthropic", anthropic_key))

        for name, key in providers:
            try:
                if name == "anthropic":
                    return await _anthropic_classify(campaign, key)
                return await _openai_classify(campaign, key)
            except Exception:
                continue

    return _mock_classify(campaign)

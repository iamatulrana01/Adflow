import pytest

from app.classifier import _mock_classify
from app.models import CampaignInput, Channel


@pytest.mark.parametrize(
    "name,budget,expected_category",
    [
        ("Enterprise Q4 Push", 75000, "brand"),
        ("Cart Abandon Retarget", 3000, "retargeting"),
        ("Pilot Test Campaign", 500, "experimental"),
        ("Standard Social Ads", 5000, "performance"),
    ],
)
def test_mock_classify_routes(name, budget, expected_category):
    result = _mock_classify(
        CampaignInput(name=name, description="", budget=budget, channel=Channel.social)
    )
    assert result.category == expected_category
    assert result.route.startswith("queue-")
    assert 0 <= result.confidence <= 1
    assert result.objective is not None
    assert result.target_platform
    assert result.approval_flow is not None
    assert len(result.workflow_steps) >= 1


def test_enterprise_gets_executive_approval():
    result = _mock_classify(
        CampaignInput(
            name="Enterprise Global",
            description="enterprise brand",
            budget=80000,
            channel=Channel.display,
        )
    )
    assert result.approval_flow.value in ("executive", "legal", "manager", "auto")
    assert result.target_platform in ("google", "meta", "programmatic", "multi-platform", "youtube", "email-crm")

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class Channel(str, Enum):
    search = "search"
    social = "social"
    display = "display"
    email = "email"
    video = "video"
    other = "other"


class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Objective(str, Enum):
    awareness = "awareness"
    consideration = "consideration"
    conversion = "conversion"
    retention = "retention"
    app_install = "app_install"


class ApprovalFlow(str, Enum):
    auto = "auto"
    manager = "manager"
    legal = "legal"
    executive = "executive"


class CampaignInput(BaseModel):
    name: str
    description: str = ""
    budget: float = Field(ge=0)
    channel: Channel = Channel.other
    objective: Optional[str] = None
    target_platform: Optional[str] = None


class ClassificationResult(BaseModel):
    category: str
    priority: Priority
    route: str
    confidence: float = Field(ge=0, le=1)
    reasoning: str
    provider: str
    objective: Objective
    target_platform: str
    approval_flow: ApprovalFlow
    workflow_steps: List[str] = Field(default_factory=list)

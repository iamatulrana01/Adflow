from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.classifier import classify_campaign
from app.models import CampaignInput, ClassificationResult

app = FastAPI(
    title="AdFlow AI Classifier",
    description="LLM-powered campaign classification and routing",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-classifier"}


@app.post("/classify", response_model=ClassificationResult)
async def classify(campaign: CampaignInput):
    return await classify_campaign(campaign)

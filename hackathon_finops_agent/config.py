import os
from dotenv import load_dotenv

# Load from .env if present
load_dotenv()

OM_URL = os.getenv("OM_URL", "http://localhost:8585/api/v1")
JWT_TOKEN = os.getenv("JWT_TOKEN", "mock_token")
DRY_RUN = os.getenv("DRY_RUN", "True").lower() in ("true", "1", "yes")

COST_PER_TABLE = 50.0

# 3-Stage State Machine Tags
TAG_UNDER_REVIEW = "FinOps.UnderReview"
TAG_WARNING = "FinOps.Warning"
TAG_ZOMBIE = "FinOps.Zombie"

# Thresholds (Days)
THRESHOLD_REVIEW = int(os.getenv("THRESHOLD_REVIEW", "7"))
THRESHOLD_WARNING = int(os.getenv("THRESHOLD_WARNING", "14"))
THRESHOLD_ZOMBIE = int(os.getenv("THRESHOLD_ZOMBIE", "30"))

# Webhooks
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")

import os
from dotenv import load_dotenv

# Load from .env if present
load_dotenv()

OM_URL = os.getenv("OM_URL", "http://localhost:8585/api/v1")
JWT_TOKEN = os.getenv("JWT_TOKEN", "mock_token")
DRY_RUN = os.getenv("DRY_RUN", "True").lower() in ("true", "1", "yes")

ZOMBIE_TAG = "FinOps.Zombie"
COST_PER_TABLE = 50.0

# Configurability for demo purposes (set to 0 for immediate demo tagging)
GRACE_PERIOD_DAYS = int(os.getenv("GRACE_PERIOD_DAYS", "7"))

import os
from dotenv import load_dotenv
from gemini_helper import get_ai_deprecation_insight

# Load environment variables
load_dotenv()

print("Testing Gemini Integration...")
insight = get_ai_deprecation_insight("test_abandoned_table", 1500.00, 60)

if insight:
    print("✅ Gemini API call successful!")
    print(insight)
else:
    print("❌ Gemini API call failed or returned empty.")

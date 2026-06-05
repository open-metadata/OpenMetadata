import os
import logging
import warnings

logger = logging.getLogger("FinOpsAgent")

def get_ai_deprecation_insight(table_name, waste_usd, age_days):
    """Uses Gemini to generate a professional FinOps justification. Fails safely."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            import google.generativeai as genai
    except ImportError:
        logger.debug("google-generativeai not installed, skipping AI insight.")
        return ""

    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        logger.debug("GEMINI_API_KEY not found in environment, skipping AI insight.")
        return "" # Graceful fallback if no key is set
        
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = f"""
        Act as a strict Enterprise Data Governance Lead.
        The table '{table_name}' has had 0 queries and 0 downstream dependencies for {age_days} days.
        It is wasting ${waste_usd:.2f} per month in AWS S3 and compute costs.
        Write a very short (1 to 2 sentences max) professional justification for deprecating this table. 
        Do not use markdown formatting.
        """
        response = model.generate_content(prompt)
        return f"\n\n[AI Insight]: {response.text.strip()}"
    except Exception as e:
        logger.warning(f"Gemini API call failed, continuing without AI insight: {e}")
        return ""

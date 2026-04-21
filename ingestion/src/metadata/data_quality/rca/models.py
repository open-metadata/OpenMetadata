#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Data models for the DQ RCA (Root Cause Analysis) agent.

AiConfig — provider configuration for the LLM call.
RcaResult — the structured output returned after a successful LLM analysis.
"""

from typing import Optional

from pydantic import ConfigDict
from pydantic.alias_generators import to_camel

from metadata.ingestion.models.custom_pydantic import BaseModel


class AiConfig(BaseModel):
    """
    Configuration for the LLM provider used to generate RCA explanations.

    Supports:
      - provider="openai"        → OpenAI chat completions API
      - provider="azure_openai"  → Azure OpenAI deployment (requires base_url)
      - provider="anthropic"     → Anthropic Messages API

    YAML keys are camelCase (apiKey, baseUrl, maxTokens, timeoutSeconds).
    Python attribute access uses snake_case (api_key, base_url, etc.).
    Both forms are accepted thanks to populate_by_name=True.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )

    provider: str
    api_key: str
    model: str
    base_url: Optional[str] = None
    max_tokens: int = 500
    timeout_seconds: int = 30


class RcaResult(BaseModel):
    """
    Structured output from a successful RCA LLM analysis.

    explanation  — LLM-generated narrative explaining the failure root cause.
    generated_at — epoch milliseconds when the explanation was produced;
                   maps to testCaseResult.rcaGeneratedAt in the schema.
    """

    explanation: str
    generated_at: int

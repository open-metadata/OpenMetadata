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
Unit tests for DQRcaAgent.

All LLM calls are mocked with unittest.mock.patch — no real network
calls or API keys are required.  Tests verify:
  - Successful path with mocked OpenAI response
  - Graceful None returns on ImportError, API errors, rate limits
  - Prompt structure and token budget
  - Anthropic provider path
"""

import time
from unittest.mock import MagicMock, patch

import pytest

from metadata.data_quality.rca.models import AiConfig, RcaResult
from metadata.data_quality.rca.rca_agent import DQRcaAgent


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures & helpers
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def openai_config() -> AiConfig:
    """AiConfig pointing at the OpenAI provider."""
    return AiConfig(provider="openai", api_key="test-key-xxx", model="gpt-4o-mini")


@pytest.fixture
def azure_config() -> AiConfig:
    """AiConfig pointing at Azure OpenAI."""
    return AiConfig(
        provider="azure_openai",
        api_key="azure-key",
        model="gpt-4o",
        base_url="https://my-resource.openai.azure.com/",
    )


@pytest.fixture
def anthropic_config() -> AiConfig:
    """AiConfig pointing at Anthropic."""
    return AiConfig(provider="anthropic", api_key="ant-key", model="claude-3-haiku-20240307")


@pytest.fixture
def realistic_signal() -> dict:
    """A realistic signal dict as returned by SignalBuilder.build()."""
    return {
        "test_name": "order_amount_range_check",
        "test_type": "columnValuesToBeBetween",
        "entity_link": "<#E::table::mydb.public.orders::columns::amount>",
        "result_message": "42 values out of range [0, 100]",
        "failed_rows": 42,
        "passed_rows": 958,
        "failed_pct": 4.2,
        "parameters": {"minValue": "0", "maxValue": "100"},
        "sample_failing_values": [
            {"amount": -5, "order_id": 1001},
            {"amount": -10, "order_id": 1002},
        ],
        "inspection_sql": "SELECT * FROM orders WHERE amount NOT BETWEEN 0 AND 100",
        "dimension_failures": [],
    }


def _make_openai_response(text: str) -> MagicMock:
    """Build a MagicMock that mimics an openai ChatCompletion response."""
    mock_msg = MagicMock()
    mock_msg.content = text
    mock_choice = MagicMock()
    mock_choice.message = mock_msg
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    return mock_response


def _make_anthropic_response(text: str) -> MagicMock:
    """Build a MagicMock that mimics an anthropic Message response."""
    mock_block = MagicMock()
    mock_block.text = text
    mock_response = MagicMock()
    mock_response.content = [mock_block]
    return mock_response


# ─────────────────────────────────────────────────────────────────────────────
# OpenAI provider tests
# ─────────────────────────────────────────────────────────────────────────────

class TestDQRcaAgentOpenAI:
    """Tests for DQRcaAgent using the openai provider."""

    def test_analyze_openai_success(self, openai_config, realistic_signal):
        """
        When openai.OpenAI returns a valid response, analyze() must return
        an RcaResult with the explanation text and a valid generated_at timestamp.
        """
        expected_text = (
            "Root cause: upstream ETL truncating values below zero. "
            "Action: check ETL step 3 for sign-flip bug."
        )
        mock_response = _make_openai_response(expected_text)

        with patch(
            "metadata.data_quality.rca.rca_agent.DQRcaAgent._call_openai",
            return_value=expected_text,
        ):
            result = DQRcaAgent(openai_config).analyze(realistic_signal)

        assert result is not None
        assert isinstance(result, RcaResult)
        assert "ETL" in result.explanation or "upstream" in result.explanation
        assert isinstance(result.generated_at, int)
        assert result.generated_at > 0
        # generated_at should be within 5 seconds of now
        now_ms = int(time.time() * 1000)
        assert abs(result.generated_at - now_ms) < 5_000

    def test_analyze_returns_none_on_import_error(self, openai_config, realistic_signal):
        """
        When the openai package is not installed (ImportError), analyze()
        must return None without propagating the exception.
        """
        with patch.dict("sys.modules", {"openai": None}):
            result = DQRcaAgent(openai_config).analyze(realistic_signal)
        assert result is None

    def test_analyze_returns_none_on_api_error(self, openai_config, realistic_signal):
        """
        When the OpenAI API raises any exception (e.g. RateLimitError),
        analyze() must return None without propagating.
        """
        with patch(
            "metadata.data_quality.rca.rca_agent.DQRcaAgent._call_openai",
            side_effect=Exception("Rate limit exceeded"),
        ):
            result = DQRcaAgent(openai_config).analyze(realistic_signal)
        assert result is None

    def test_analyze_returns_none_when_llm_returns_empty(self, openai_config, realistic_signal):
        """
        When the LLM returns an empty string, analyze() must return None
        (not an RcaResult with an empty explanation).
        """
        with patch(
            "metadata.data_quality.rca.rca_agent.DQRcaAgent._call_openai",
            return_value="",
        ):
            result = DQRcaAgent(openai_config).analyze(realistic_signal)
        assert result is None

    def test_analyze_strips_whitespace_from_explanation(self, openai_config, realistic_signal):
        """
        Trailing/leading whitespace in the LLM output must be stripped
        before being stored in RcaResult.explanation.
        """
        with patch(
            "metadata.data_quality.rca.rca_agent.DQRcaAgent._call_openai",
            return_value="  Root cause: bad data.  ",
        ):
            result = DQRcaAgent(openai_config).analyze(realistic_signal)
        assert result is not None
        assert result.explanation == "Root cause: bad data."


# ─────────────────────────────────────────────────────────────────────────────
# Anthropic provider tests
# ─────────────────────────────────────────────────────────────────────────────

class TestDQRcaAgentAnthropic:
    """Tests for DQRcaAgent using the anthropic provider."""

    def test_analyze_returns_none_on_anthropic_import_error(
        self, anthropic_config, realistic_signal
    ):
        """
        When the anthropic package is not installed (ImportError), analyze()
        must return None without propagating.
        """
        with patch.dict("sys.modules", {"anthropic": None}):
            result = DQRcaAgent(anthropic_config).analyze(realistic_signal)
        assert result is None

    def test_analyze_anthropic_success(self, anthropic_config, realistic_signal):
        """
        When the Anthropic Messages API returns a valid TextBlock, analyze()
        must return an RcaResult with the correct explanation.
        """
        expected_text = "Root cause: missing null check. Action: add NOT NULL constraint."
        with patch(
            "metadata.data_quality.rca.rca_agent.DQRcaAgent._call_anthropic",
            return_value=expected_text,
        ):
            result = DQRcaAgent(anthropic_config).analyze(realistic_signal)
        assert result is not None
        assert result.explanation == expected_text

    def test_analyze_returns_none_on_anthropic_api_error(
        self, anthropic_config, realistic_signal
    ):
        """
        When the Anthropic API raises, analyze() must return None gracefully.
        """
        with patch(
            "metadata.data_quality.rca.rca_agent.DQRcaAgent._call_anthropic",
            side_effect=Exception("API overloaded"),
        ):
            result = DQRcaAgent(anthropic_config).analyze(realistic_signal)
        assert result is None


# ─────────────────────────────────────────────────────────────────────────────
# Unsupported provider
# ─────────────────────────────────────────────────────────────────────────────

class TestDQRcaAgentUnsupportedProvider:
    """Tests for DQRcaAgent with an unrecognised provider string."""

    def test_unsupported_provider_returns_none(self, realistic_signal):
        """
        When provider is an unrecognised string, analyze() must return None
        without raising and without calling any LLM.
        """
        bad_config = AiConfig(provider="gemini", api_key="key", model="gemini-pro")
        result = DQRcaAgent(bad_config).analyze(realistic_signal)
        assert result is None


# ─────────────────────────────────────────────────────────────────────────────
# Prompt structure
# ─────────────────────────────────────────────────────────────────────────────

class TestDQRcaAgentPrompt:
    """Tests verifying the prompt built by _build_prompt()."""

    def test_build_prompt_is_under_token_budget(self, openai_config, realistic_signal):
        """
        The generated prompt must be short enough to stay within the token
        budget.  We use word count as a proxy (< 300 words ≈ < 400 tokens).
        """
        agent = DQRcaAgent(openai_config)
        prompt = agent._build_prompt(realistic_signal)
        word_count = len(prompt.split())
        assert word_count < 300, f"Prompt too long: {word_count} words"

    def test_build_prompt_contains_instruction_keywords(self, openai_config, realistic_signal):
        """
        The prompt must contain the key instruction phrases so the LLM knows
        what output format is expected.
        """
        agent = DQRcaAgent(openai_config)
        prompt = agent._build_prompt(realistic_signal).lower()
        assert "root cause" in prompt or "most likely" in prompt

    def test_build_prompt_contains_test_name(self, openai_config, realistic_signal):
        """The test case name must appear in the prompt for context."""
        agent = DQRcaAgent(openai_config)
        prompt = agent._build_prompt(realistic_signal)
        assert "order_amount_range_check" in prompt

    def test_build_prompt_contains_diagnostic_hint(self, openai_config, realistic_signal):
        """
        Because test_type is 'columnValuesToBeBetween', the prompt should
        contain the matching diagnostic hint text.
        """
        agent = DQRcaAgent(openai_config)
        prompt = agent._build_prompt(realistic_signal)
        # The hint for columnValuesToBeBetween mentions "range"
        assert "range" in prompt.lower() or "bound" in prompt.lower()

    def test_build_prompt_includes_sample_rows(self, openai_config, realistic_signal):
        """Sample failing rows must be included in the prompt when present."""
        agent = DQRcaAgent(openai_config)
        prompt = agent._build_prompt(realistic_signal)
        assert "Sample failing rows" in prompt

    def test_build_prompt_includes_parameters(self, openai_config, realistic_signal):
        """Test parameters (min/max) must be visible in the prompt."""
        agent = DQRcaAgent(openai_config)
        prompt = agent._build_prompt(realistic_signal)
        assert "Test parameters" in prompt

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
DQRcaAgent — LLM-powered root cause analysis for failed DQ test cases.

Design principles:
  1.  All LLM calls are wrapped in try/except — RCA failure MUST NEVER
      propagate into the DQ pipeline.  Return None on any error.
  2.  Imports for openai and anthropic are LAZY (inside the method that
      uses them) so that the module can be imported even when neither
      SDK is installed.
  3.  Providers supported: "openai", "azure_openai", "anthropic".
  4.  The prompt is kept token-efficient (< 800 tokens) leaving room for
      the model's max_tokens response budget.
"""

from datetime import datetime, timezone
from typing import Optional

from metadata.data_quality.rca.models import AiConfig, RcaResult
from metadata.data_quality.rca.templates import get_hint
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class DQRcaAgent:
    """
    Agent that calls an LLM to generate a root cause analysis explanation
    for a failed data quality check.

    Usage::

        agent = DQRcaAgent(ai_config)
        rca = agent.analyze(signal)   # signal built by SignalBuilder.build()
        if rca:
            result.rcaExplanation = rca.explanation
            result.rcaGeneratedAt = rca.generated_at
    """

    def __init__(self, ai_config: AiConfig) -> None:
        self.config = ai_config
        self._openai_client = None
        self._anthropic_client = None

    # ──────────────────────────────────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────────────────────────────────

    def analyze(self, signal: dict) -> Optional[RcaResult]:
        """
        Takes a signal dict produced by SignalBuilder and returns an RcaResult.

        Returns None if the LLM call fails for any reason so the caller can
        continue without breaking the DQ pipeline.
        """
        try:
            prompt = self._build_prompt(signal)
            explanation = self._call_llm(prompt)
            if not explanation:
                return None
            return RcaResult(
                explanation=explanation.strip(),
                generated_at=int(datetime.now(timezone.utc).timestamp() * 1000),
            )
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning(
                f"RCA analysis failed for test '{signal.get('test_name')}': {exc}"
            )
            return None

    # ──────────────────────────────────────────────────────────────────────────
    # Prompt construction
    # ──────────────────────────────────────────────────────────────────────────

    def _build_prompt(self, signal: dict) -> str:
        """
        Assemble a focused, token-efficient prompt for the LLM.

        Sections are added conditionally so that an empty field does not waste
        tokens.  Target is < 800 tokens total (system + user) which, combined
        with max_tokens=500 for the response, stays comfortably within the
        budget of even the smallest supported models.
        """
        hint = get_hint(signal.get("test_type", ""))

        # Optional sections — only included when data is present
        params_section = ""
        if signal.get("parameters"):
            params_section = f"Test parameters: {signal['parameters']}\n"

        samples_section = ""
        samples = signal.get("sample_failing_values") or []
        if samples:
            # Limit to 3 sample rows to keep prompt size predictable
            samples_section = f"Sample failing rows (up to 3): {samples[:3]}\n"

        sql_section = ""
        if signal.get("inspection_sql"):
            sql_section = f"Inspection SQL: {signal['inspection_sql'][:300]}\n"

        dimension_section = ""
        dim_failures = signal.get("dimension_failures") or []
        if dim_failures:
            dimension_section = f"Failed dimensions: {', '.join(dim_failures[:10])}\n"

        failed_pct = signal.get("failed_pct")
        pct_str = f" ({failed_pct:.1f}%)" if failed_pct is not None else ""
        failed_rows = signal.get("failed_rows")
        rows_str = f"{failed_rows}{pct_str}" if failed_rows is not None else "unknown"

        prompt = (
            "You are a data quality expert. A data quality check has failed.\n"
            "Analyze the failure context below and provide a concise root cause explanation.\n\n"
            f"Test name  : {signal.get('test_name', 'unknown')}\n"
            f"Test type  : {signal.get('test_type', 'unknown')}\n"
            f"Data asset : {signal.get('entity_link', 'unknown')}\n"
            f"Validator result: {signal.get('result_message', '')}\n"
            f"Failed rows: {rows_str}\n"
            f"{params_section}"
            f"{samples_section}"
            f"{sql_section}"
            f"{dimension_section}"
            f"Diagnostic hint: {hint}\n\n"
            "Respond with:\n"
            "1. Most likely root cause (1-2 sentences, specific and concrete)\n"
            "2. Suggested next action (1 sentence)\n\n"
            "Do not repeat the test name. Maximum 100 words."
        )
        return prompt

    # ──────────────────────────────────────────────────────────────────────────
    # Provider dispatch
    # ──────────────────────────────────────────────────────────────────────────

    def _call_llm(self, prompt: str) -> Optional[str]:
        """
        Route to the correct provider based on self.config.provider.

        Returns the raw text response, or None on any failure.
        """
        provider = (self.config.provider or "").lower()

        if provider in ("openai", "azure_openai"):
            return self._call_openai(prompt)
        if provider == "anthropic":
            return self._call_anthropic(prompt)

        logger.warning(
            f"RCA: unsupported provider '{self.config.provider}'. "
            "Expected one of: openai, azure_openai, anthropic."
        )
        return None

    # ──────────────────────────────────────────────────────────────────────────
    # Provider implementations (lazy imports)
    # ──────────────────────────────────────────────────────────────────────────

    def _call_openai(self, prompt: str) -> Optional[str]:
        """
        Call OpenAI or Azure OpenAI chat completions.

        The openai SDK (>=1.0.0) is imported lazily so that the module can be
        loaded without the SDK installed — only actual RCA calls will fail.
        The client is cached on self._openai_client to avoid opening a new
        HTTP connection on every call.
        """
        try:
            # pylint: disable=import-outside-toplevel
            from openai import AzureOpenAI, OpenAI  # lazy import

            if self._openai_client is None:
                if self.config.provider.lower() == "azure_openai":
                    self._openai_client = AzureOpenAI(
                        api_key=self.config.api_key.get_secret_value(),
                        azure_endpoint=self.config.base_url or "",
                        api_version="2024-02-01",
                    )
                else:
                    kwargs = {"api_key": self.config.api_key.get_secret_value()}
                    if self.config.base_url:
                        kwargs["base_url"] = self.config.base_url
                    self._openai_client = OpenAI(**kwargs)
            client = self._openai_client

            response = client.chat.completions.create(
                model=self.config.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=self.config.max_tokens,
                timeout=self.config.timeout_seconds,
            )
            text = response.choices[0].message.content
            return text

        except ImportError:
            logger.warning(
                "RCA: 'openai' package is not installed. "
                "Install it with: pip install openai"
            )
            return None
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning(f"RCA: OpenAI call failed: {exc}")
            return None

    def _call_anthropic(self, prompt: str) -> Optional[str]:
        """
        Call Anthropic Messages API.

        The anthropic SDK is imported lazily for the same reason as openai.
        The client is cached on self._anthropic_client to avoid opening a new
        HTTP connection on every call.
        """
        try:
            # pylint: disable=import-outside-toplevel
            import anthropic  # lazy import

            if self._anthropic_client is None:
                self._anthropic_client = anthropic.Anthropic(
                    api_key=self.config.api_key.get_secret_value(),
                    timeout=self.config.timeout_seconds,
                )
            client = self._anthropic_client

            message = client.messages.create(
                model=self.config.model,
                max_tokens=self.config.max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            # content is a list of ContentBlock objects; first is usually TextBlock
            first_block = message.content[0] if message.content else None
            if first_block is None:
                return None
            return getattr(first_block, "text", None)

        except ImportError:
            logger.warning(
                "RCA: 'anthropic' package is not installed. "
                "Install it with: pip install anthropic"
            )
            return None
        except Exception as exc:  # pylint: disable=broad-except
            logger.warning(f"RCA: Anthropic call failed: {exc}")
            return None

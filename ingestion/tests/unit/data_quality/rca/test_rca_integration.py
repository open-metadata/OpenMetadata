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
Integration-level tests for _run_rca_analysis() guard conditions.

We intentionally do NOT instantiate a real TestSuiteInterface because
doing so requires a live database connection, a sampler, and an OMetadata
client.  Instead, we call the unbound method on a MagicMock(spec=...)
instance — this exercises the real method body while letting all
infrastructure dependencies remain mocked.

Pattern (same as test_test_case_runner.py):
    instance = MagicMock(spec=TestSuiteInterface)
    instance.<attr> = <value>
    TestSuiteInterface._run_rca_analysis(instance, response, test_case)
"""

from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest

from metadata.data_quality.api.models import TestCaseResultResponse
from metadata.data_quality.interface.test_suite_interface import TestSuiteInterface
from metadata.data_quality.rca.models import AiConfig, RcaResult
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.entityReference import EntityReference


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures & helpers
# ─────────────────────────────────────────────────────────────────────────────

def _entity_ref(name: str, ref_type: str = "testSuite") -> EntityReference:
    return EntityReference(
        id=str(UUID(int=hash(name) % (10**10))),
        type=ref_type,
        name=name,
    )


def _make_test_case(enable_rca: bool = True) -> MagicMock:
    """
    Build a MagicMock impersonating a TestCase.

    The generated Python TestCase class does not yet have enableRcaAnalysis
    (code generation not run). MagicMock(spec=TestCase) lets us set arbitrary
    attributes while still satisfying isinstance() checks.
    """
    tc = MagicMock(spec=TestCase)
    tc.name = "null_check"
    tc.enableRcaAnalysis = enable_rca
    return tc


def _make_test_result(status: TestCaseStatus = TestCaseStatus.Failed) -> MagicMock:
    """
    Build a MagicMock impersonating a TestCaseResult.

    We use MagicMock so we can freely set rcaExplanation / rcaGeneratedAt
    without Pydantic raising 'Extra inputs not permitted' (those fields are
    not yet in the generated Python class).
    """
    result = MagicMock(spec=TestCaseResult)
    result.testCaseStatus = status
    result.rcaExplanation = None
    result.rcaGeneratedAt = None
    return result


def _make_response(status: TestCaseStatus = TestCaseStatus.Failed) -> TestCaseResultResponse:
    """Helper: Return a TestCaseResultResponse with the given status."""
    return TestCaseResultResponse(
        testCaseResult=_make_test_result(status),
        testCase=_make_test_case(),
    )


def _make_ai_config() -> AiConfig:
    """Return a valid AiConfig for testing."""
    return AiConfig(provider="openai", api_key="test-key", model="gpt-4o-mini")


def _make_interface_instance(ai_config: AiConfig | None = None) -> MagicMock:
    """
    Create a MagicMock with TestSuiteInterface spec and set ai_config.
    This lets us call TestSuiteInterface._run_rca_analysis(instance, ...) to
    exercise the real method body via unbound method invocation.
    """
    instance = MagicMock(spec=TestSuiteInterface)
    instance.ai_config = ai_config
    return instance


# ─────────────────────────────────────────────────────────────────────────────
# Guard condition tests
# ─────────────────────────────────────────────────────────────────────────────

class TestRcaAnalysisGuards:
    """
    Tests verifying that _run_rca_analysis() skips agent invocation
    when any of its 3 guard conditions are not met.
    """

    def test_rca_skipped_when_ai_config_none(self):
        """
        Guard 1: when self.ai_config is None, the agent must never be called
        regardless of test status or enableRcaAnalysis flag.
        """
        instance = _make_interface_instance(ai_config=None)
        response = _make_response(status=TestCaseStatus.Failed)
        test_case = _make_test_case(enable_rca=True)

        with patch(
            "metadata.data_quality.rca.rca_agent.DQRcaAgent.analyze"
        ) as mock_analyze:
            TestSuiteInterface._run_rca_analysis(instance, response, test_case)
            mock_analyze.assert_not_called()

        # Fields must remain unset
        assert getattr(response.testCaseResult, "rcaExplanation", None) is None
        assert getattr(response.testCaseResult, "rcaGeneratedAt", None) is None

    def test_rca_skipped_when_status_success(self):
        """
        Guard 2: when testCaseStatus is Success (not Failed), the agent
        must not be invoked even if ai_config is set.
        """
        instance = _make_interface_instance(ai_config=_make_ai_config())
        response = _make_response(status=TestCaseStatus.Success)
        test_case = _make_test_case(enable_rca=True)

        with patch(
            "metadata.data_quality.rca.rca_agent.DQRcaAgent.analyze"
        ) as mock_analyze:
            TestSuiteInterface._run_rca_analysis(instance, response, test_case)
            mock_analyze.assert_not_called()

    def test_rca_skipped_when_status_aborted(self):
        """
        Guard 2: Aborted status (error during validation) must also skip RCA.
        """
        instance = _make_interface_instance(ai_config=_make_ai_config())
        response = _make_response(status=TestCaseStatus.Aborted)
        test_case = _make_test_case(enable_rca=True)

        with patch(
            "metadata.data_quality.rca.rca_agent.DQRcaAgent.analyze"
        ) as mock_analyze:
            TestSuiteInterface._run_rca_analysis(instance, response, test_case)
            mock_analyze.assert_not_called()

    def test_rca_skipped_when_enable_flag_false(self):
        """
        Guard 3: when enableRcaAnalysis is False on the test case, the agent
        must not run even when status is Failed and ai_config is set.
        This mirrors the computePassedFailedRowCount opt-in pattern.
        """
        instance = _make_interface_instance(ai_config=_make_ai_config())
        response = _make_response(status=TestCaseStatus.Failed)
        test_case = _make_test_case(enable_rca=False)  # opt-out

        with patch(
            "metadata.data_quality.rca.rca_agent.DQRcaAgent.analyze"
        ) as mock_analyze:
            TestSuiteInterface._run_rca_analysis(instance, response, test_case)
            mock_analyze.assert_not_called()

    def test_rca_skipped_when_enable_flag_missing(self):
        """
        Guard 3: when the enableRcaAnalysis attribute is entirely absent
        (old TestCase entity from before Slice 1 schema migration), the
        getattr default of False must prevent agent invocation.
        """
        instance = _make_interface_instance(ai_config=_make_ai_config())
        response = _make_response(status=TestCaseStatus.Failed)
        # Build a test case without enableRcaAnalysis using MagicMock
        test_case = MagicMock()
        del test_case.enableRcaAnalysis  # ensure attribute is absent

        with patch(
            "metadata.data_quality.rca.rca_agent.DQRcaAgent.analyze"
        ) as mock_analyze:
            TestSuiteInterface._run_rca_analysis(instance, response, test_case)
            mock_analyze.assert_not_called()


# ─────────────────────────────────────────────────────────────────────────────
# Happy path — all guards pass
# ─────────────────────────────────────────────────────────────────────────────

class TestRcaAnalysisHappyPath:
    """
    Tests verifying that _run_rca_analysis() correctly attaches the RCA
    output to response.testCaseResult when all 3 guards pass.
    """

    def test_rca_attaches_explanation_to_test_case_result(self):
        """
        When all 3 guards pass and the agent returns an RcaResult, both
        rcaExplanation and rcaGeneratedAt must be set on
        response.testCaseResult (not on response directly).
        """
        instance = _make_interface_instance(ai_config=_make_ai_config())
        response = _make_response(status=TestCaseStatus.Failed)
        test_case = _make_test_case(enable_rca=True)

        mock_rca = RcaResult(explanation="Test explanation", generated_at=12345)

        with patch(
            "metadata.data_quality.rca.rca_agent.DQRcaAgent.analyze",
            return_value=mock_rca,
        ):
            TestSuiteInterface._run_rca_analysis(instance, response, test_case)

        # Fields must be on testCaseResult, not on response
        assert response.testCaseResult.rcaExplanation == "Test explanation"
        assert response.testCaseResult.rcaGeneratedAt == 12345

    def test_rca_not_set_when_agent_returns_none(self):
        """
        When the agent returns None (LLM call failed), neither
        rcaExplanation nor rcaGeneratedAt should be set.
        """
        instance = _make_interface_instance(ai_config=_make_ai_config())
        response = _make_response(status=TestCaseStatus.Failed)
        test_case = _make_test_case(enable_rca=True)

        with patch(
            "metadata.data_quality.rca.rca_agent.DQRcaAgent.analyze",
            return_value=None,
        ):
            TestSuiteInterface._run_rca_analysis(instance, response, test_case)

        assert getattr(response.testCaseResult, "rcaExplanation", None) is None
        assert getattr(response.testCaseResult, "rcaGeneratedAt", None) is None


# ─────────────────────────────────────────────────────────────────────────────
# Safety — method must never raise
# ─────────────────────────────────────────────────────────────────────────────

class TestRcaAnalysisSafety:
    """
    Tests verifying that _run_rca_analysis() never propagates exceptions
    even when the agent itself crashes with an unhandled error.
    """

    def test_rca_never_raises_when_agent_crashes(self):
        """
        If DQRcaAgent.analyze() raises an unhandled exception, the outer
        try/except in _run_rca_analysis must absorb it so the DQ pipeline
        result is still returned intact.
        """
        instance = _make_interface_instance(ai_config=_make_ai_config())
        response = _make_response(status=TestCaseStatus.Failed)
        test_case = _make_test_case(enable_rca=True)

        with patch(
            "metadata.data_quality.rca.rca_agent.DQRcaAgent.analyze",
            side_effect=RuntimeError("Unexpected crash inside agent"),
        ):
            try:
                TestSuiteInterface._run_rca_analysis(instance, response, test_case)
            except Exception as exc:  # pragma: no cover
                pytest.fail(
                    f"_run_rca_analysis propagated an exception when it must not: {exc}"
                )

    def test_rca_never_raises_with_malformed_response(self):
        """
        Even with a completely malformed response (MagicMock), _run_rca_analysis
        must not propagate any exception — the outer except covers all paths.
        """
        instance = _make_interface_instance(ai_config=_make_ai_config())
        broken_response = MagicMock()
        broken_response.testCaseResult.testCaseStatus = TestCaseStatus.Failed
        broken_test_case = MagicMock()
        broken_test_case.enableRcaAnalysis = True

        try:
            TestSuiteInterface._run_rca_analysis(
                instance, broken_response, broken_test_case
            )
        except Exception as exc:  # pragma: no cover
            pytest.fail(f"_run_rca_analysis raised with malformed input: {exc}")

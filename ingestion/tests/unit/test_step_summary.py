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
Unit tests for Summary.from_step failure reporting: the default 10-failure
display cap versus the report_all_failures opt-out that a step sets when
downstream logic needs the complete failure list.
"""

from metadata.ingestion.api.models import StackTraceError
from metadata.ingestion.api.step import Step, Summary
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class _DummyStep(Step):
    """Minimal concrete Step that keeps the default failure cap (report_all_failures=False)."""

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ) -> "Step":
        return cls()

    @property
    def name(self) -> str:
        return "dummy"

    def close(self) -> None:
        pass


class _ReportAllStep(_DummyStep):
    """Opts into the complete failure list."""

    report_all_failures = True


def _add_failures(step: Step, count: int) -> None:
    for i in range(count):
        step.status.failed(StackTraceError(name=f"err-{i}", error=f"boom-{i}", stackTrace=""))


def test_default_step_caps_failures_at_ten():
    step = _DummyStep()
    _add_failures(step, 25)

    summary = Summary.from_step(step)

    # The error COUNT stays complete; only the displayed list is capped.
    assert summary.errors == 25
    assert summary.failures is not None
    assert len(summary.failures) == 10


def test_report_all_failures_returns_full_list():
    step = _ReportAllStep()
    _add_failures(step, 25)

    summary = Summary.from_step(step)

    assert summary.errors == 25
    # Opt-in => the complete list survives, so downstream logic sees every failure.
    assert summary.failures is not None
    assert len(summary.failures) == 25


def test_report_all_failures_below_cap_is_unaffected():
    step = _ReportAllStep()
    _add_failures(step, 3)

    summary = Summary.from_step(step)

    assert summary.failures is not None
    assert len(summary.failures) == 3


def test_no_failures_reports_none():
    step = _DummyStep()

    summary = Summary.from_step(step)

    assert summary.errors == 0
    assert summary.failures is None

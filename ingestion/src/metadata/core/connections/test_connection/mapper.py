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
Named constructors for a ``TestConnectionStepResult``.

Two axes describe a step outcome: ``passed`` is the boolean (did the check do its
job?), ``status`` is the disposition/severity. ``Warning`` is the non-blocking
"caution" bucket - either a non-mandatory step that *failed* (the user may just
miss some metadata) or a step that *passed* but carries a ``caveat`` worth
noticing. ``passed`` disambiguates the two. A ``Diagnosis`` (a classified failure
or a caveat) is carried in the ``diagnosis`` field; the raw ``errorLog`` is
failure-only.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    Diagnosis as ResultDiagnosis,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    SkipReason,
    Status,
    TestConnectionStepResult,
)

if TYPE_CHECKING:
    from metadata.core.connections.test_connection.records import Diagnosis, Evidence
    from metadata.generated.schema.entity.services.connections.testConnectionDefinition import (
        TestConnectionStep,
    )


class StepResultBuilder:
    """Factory classmethods translating a step outcome into a step result."""

    @classmethod
    def passed(
        cls,
        step: TestConnectionStep,
        evidence: Evidence,
        duration_ms: int,
    ) -> TestConnectionStepResult:
        return cls._result(
            step,
            Status.Warning if evidence.caveat else Status.Passed,
            passed=True,
            diagnosis=_to_result_diagnosis(evidence.caveat),
            duration_ms=duration_ms,
            executed_command=evidence.command,
            result_summary=evidence.summary,
        )

    @classmethod
    def failed(
        cls,
        step: TestConnectionStep,
        error: BaseException,
        diagnosis: Diagnosis | None = None,
        duration_ms: int | None = None,
        evidence: Evidence | None = None,
    ) -> TestConnectionStepResult:
        status = Status.Failed if step.mandatory else Status.Warning
        return cls._result(
            step,
            status,
            passed=False,
            error_log=str(error),
            diagnosis=_to_result_diagnosis(diagnosis),
            duration_ms=duration_ms,
            executed_command=evidence.command if evidence else None,
            result_summary=evidence.summary if evidence else None,
        )

    @classmethod
    def skipped(cls, step: TestConnectionStep, reason: SkipReason) -> TestConnectionStepResult:
        return cls._result(step, Status.Skipped, passed=False, skip_reason=reason)

    @classmethod
    def _result(
        cls,
        step: TestConnectionStep,
        status: Status,
        *,
        passed: bool,
        error_log: str | None = None,
        skip_reason: SkipReason | None = None,
        diagnosis: ResultDiagnosis | None = None,
        duration_ms: int | None = None,
        executed_command: str | None = None,
        result_summary: str | None = None,
    ) -> TestConnectionStepResult:
        return TestConnectionStepResult(
            name=step.name,
            mandatory=step.mandatory,
            passed=passed,
            status=status,
            message=None,
            errorLog=error_log,
            skipReason=skip_reason,
            diagnosis=diagnosis,
            durationMs=duration_ms,
            executedCommand=executed_command,
            resultSummary=result_summary,
        )


def _to_result_diagnosis(diagnosis: Diagnosis | None) -> ResultDiagnosis | None:
    if diagnosis is None:
        return None
    return ResultDiagnosis(
        title=diagnosis.title,
        remediation=diagnosis.remediation,
        docUrl=diagnosis.doc_url,
    )

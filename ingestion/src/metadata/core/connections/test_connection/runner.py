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
The orchestrator behind ``BaseConnection.test_connection``.

It fetches the definition (which owns step order, category and mandatory flags),
resolves each step to a ``@check`` method on the provider, runs them in that
order, and maps every outcome to a result. A missing check becomes a visible
``Skipped`` - never a crash. Once a gate step fails, every subsequent step is
skipped as ``ConnectionNotEstablished``. The workflow is patched after each step
so the UI sees honest progress.
"""

from __future__ import annotations

from datetime import datetime
from time import perf_counter
from typing import TYPE_CHECKING

from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.constants import STEP_TIMEOUT_SECONDS
from metadata.core.connections.test_connection.mapper import StepResultBuilder
from metadata.core.connections.test_connection.records import Diagnosis, Evidence
from metadata.generated.schema.entity.automations.workflow import WorkflowStatus
from metadata.generated.schema.entity.services.connections.testConnectionDefinition import (
    Category,
    TestConnectionDefinition,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    SkipReason,
    StatusType,
    TestConnectionResult,
    TestConnectionStepResult,
)
from metadata.generated.schema.type.basic import Timestamp
from metadata.utils.logger import ingestion_logger
from metadata.utils.timeout import timeout

if TYPE_CHECKING:
    from metadata.core.connections.test_connection.check import (
        CheckMethod,
        ChecksProvider,
    )
    from metadata.generated.schema.entity.automations.workflow import (
        Workflow as AutomationWorkflow,
    )
    from metadata.generated.schema.entity.services.connections.testConnectionDefinition import (
        TestConnectionStep,
    )
    from metadata.ingestion.ometa.ometa_api import OpenMetadata

logger = ingestion_logger()


class TestConnectionDefinitionNotFoundError(Exception):
    """Raised when a service type has no test-connection definition to run."""


class TestConnectionRunner:
    """Run a provider's checks against its service-type definition."""

    __test__ = False  # not a pytest test class despite the "Test" prefix

    def __init__(
        self,
        checks: ChecksProvider,
        service_type: str,
        timeout_seconds: int | None = STEP_TIMEOUT_SECONDS,
    ) -> None:
        self._checks = checks
        self._service_type = service_type
        self._timeout_seconds = timeout_seconds

    def run(
        self,
        metadata: OpenMetadata,
        automation_workflow: AutomationWorkflow | None = None,
    ) -> TestConnectionResult:
        result = TestConnectionResult(lastUpdatedAt=None, status=StatusType.Running, steps=[])
        try:
            definition = self._definition(metadata)
            checks = collect_checks(self._checks)
        except Exception:
            # A failure before any step runs (e.g. the definition is missing) must
            # still leave the workflow terminal, or the UI polls it forever.
            result.status = StatusType.Failed
            self._patch(metadata, automation_workflow, result, final=True)
            raise
        gate_failed = False
        for step in definition.steps or []:
            step_result = self._run_step(checks.get(step.name), step, gate_failed)
            logger.info("%s", _step_log(step_result))
            if not step_result.passed and _is_gate(step):
                gate_failed = True
            result.steps.append(step_result)
            self._patch(metadata, automation_workflow, result)
        final_status = _final_status(result)
        result.status = final_status
        logger.info("Test connection for %r: %s", self._service_type, final_status.value)
        self._patch(metadata, automation_workflow, result, final=True)
        return result

    def _definition(self, metadata: OpenMetadata) -> TestConnectionDefinition:
        fqn = f"{self._service_type}.testConnectionDefinition"
        definition = metadata.get_by_name(entity=TestConnectionDefinition, fqn=fqn)
        if definition is None:
            raise TestConnectionDefinitionNotFoundError(
                f"Test connection definition '{fqn}' not found. Ensure the "
                "ingestion-bot token is valid and the workflow is up to date."
            )
        return definition

    def _run_step(
        self,
        method: CheckMethod | None,
        step: TestConnectionStep,
        gate_failed: bool,
    ) -> TestConnectionStepResult:
        if gate_failed:
            return StepResultBuilder.skipped(step, SkipReason.ConnectionNotEstablished)
        if method is None:
            logger.warning("No check implemented for step %r", step.name)
            return StepResultBuilder.skipped(step, SkipReason.NotImplemented)
        started = perf_counter()
        try:
            evidence = self._call(method) or Evidence()
            return StepResultBuilder.passed(step, evidence, _elapsed_ms(started))
        except CheckError as failure:
            return self._failed_step(step, failure.cause, failure.evidence, started)
        except Exception as error:
            return self._failed_step(step, error, None, started)

    def _failed_step(
        self,
        step: TestConnectionStep,
        error: BaseException,
        evidence: Evidence | None,
        started: float,
    ) -> TestConnectionStepResult:
        duration = _elapsed_ms(started)
        logger.debug("Step %r failed", step.name, exc_info=True)
        if self._step_timed_out(error, duration):
            diagnosis = _timeout_diagnosis(self._timeout_seconds)
        else:
            diagnosis = self._checks.errors.classify(error)
        return StepResultBuilder.failed(step, error, diagnosis, duration, evidence)

    def _step_timed_out(self, error: BaseException, duration_ms: int) -> bool:
        """The per-step ``timeout()`` raises ``TimeoutError`` after the budget;
        the driver may wrap it, but it survives in the cause chain. Require both
        signals - the chain marker and a full-budget duration - so a driver's own
        fast timeout is not misread as ours."""
        return (
            bool(self._timeout_seconds)
            and duration_ms >= self._timeout_seconds * 1000
            and any(isinstance(exc, TimeoutError) for exc in exception_chain(error))
        )

    def _call(self, method: CheckMethod) -> Evidence | None:
        """Run a check, bounding it to a per-step timeout when configured.

        Returns the check's ``Evidence`` (or ``None`` when it reports nothing,
        which the caller coerces to empty ``Evidence``). The timeout is
        SIGALRM-based, so it only applies on the main thread; a timed-out check
        raises ``TimeoutError`` which is mapped to a failed step.
        """
        if self._timeout_seconds:
            return timeout(self._timeout_seconds)(method)()
        return method()

    def _patch(
        self,
        metadata: OpenMetadata,
        automation_workflow: AutomationWorkflow | None,
        result: TestConnectionResult,
        final: bool = False,
    ) -> None:
        if automation_workflow is None:
            return
        result.lastUpdatedAt = Timestamp(int(datetime.now().timestamp() * 1000))
        metadata.patch_automation_workflow_response(automation_workflow, result, _workflow_status(result, final))


def _elapsed_ms(started: float) -> int:
    return int((perf_counter() - started) * 1000)


def _timeout_diagnosis(seconds: int | None) -> Diagnosis:
    return Diagnosis(
        title="Check timed out",
        remediation=f"The step did not respond within {seconds}s; the source may be "
        "slow, overloaded, or unreachable. Check its load and the network.",
    )


def _step_log(step_result: TestConnectionStepResult) -> str:
    status = step_result.status.value if step_result.status else "?"
    if step_result.errorLog:
        return f"{step_result.name}: {status} - {step_result.errorLog}"
    if step_result.skipReason:
        return f"{step_result.name}: {status} ({step_result.skipReason.value})"
    return f"{step_result.name}: {status}"


def _workflow_status(result: TestConnectionResult, final: bool) -> WorkflowStatus:
    """Mid-run the workflow is Running; the final patch mirrors the result so a
    failed test is not reported as a successful workflow."""
    if not final:
        status = WorkflowStatus.Running
    elif result.status == StatusType.Successful:
        status = WorkflowStatus.Successful
    else:
        status = WorkflowStatus.Failed
    return status


def _is_gate(step: TestConnectionStep) -> bool:
    return step.category == Category.ConnectionGate


def _final_status(result: TestConnectionResult) -> StatusType:
    """Successful only if every mandatory step's check passed; a mandatory step
    that failed or did not run fails the whole test.

    Reads ``passed`` (the outcome) rather than ``status`` (the severity), so a
    mandatory step that passed with a non-blocking caveat (``Warning`` but
    ``passed`` is ``True``) still counts as successful."""
    mandatory_passed = all(step.passed for step in result.steps if step.mandatory)
    return StatusType.Successful if mandatory_passed else StatusType.Failed

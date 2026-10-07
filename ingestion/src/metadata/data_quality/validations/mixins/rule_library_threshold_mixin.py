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

"""Failure threshold handling shared by the column and table rule-library validators"""

from metadata.data_quality.validations import result_messages
from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.data_quality.validations.models import (
    RuleLibrarySqlExpressionRuntimeParameters,
)
from metadata.data_quality.validations.thresholds import (
    THRESHOLD_UNIT_PARAM,
    FailureThreshold,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestResultValue

VIOLATION_NOUN = "rows matching the condition"


class RuleLibraryThresholdMixin(BaseTestValidator):
    """Row tolerance for rule-library validators: the rule's rows are the violations

    Rule-library definitions are authored by users, so a `threshold` parameter may already be
    one of the rule's own template parameters. Like the server's `TestCaseThresholdValidator`,
    only a definition that declares `thresholdUnit` is read as opted in to failure thresholds;
    any other one keeps the `count == 0` verdict it had before thresholds existed.
    """

    runtime_params: RuleLibrarySqlExpressionRuntimeParameters

    def _run_row_count(self) -> int:
        """Rows the violations are counted against, read from the same rows the rule ran on"""
        raise NotImplementedError

    def _declares_failure_threshold(self) -> bool:
        runtime_params = getattr(self, "runtime_params", None)
        if runtime_params is None:
            return False
        parameters = runtime_params.test_definition.parameterDefinition or []
        return any(parameter.name == THRESHOLD_UNIT_PARAM for parameter in parameters)

    def _read_failure_threshold(self) -> FailureThreshold:
        if not self._declares_failure_threshold():
            return FailureThreshold()
        return super()._read_failure_threshold()

    def get_rule_library_result(self, subject: str, violations: int) -> TestCaseResult:
        """Evaluate the rule's violation count against the failure threshold

        Args:
            subject: what the rule ran against, e.g. "Column 'email' in table 'db.schema.users'"
            violations: rows the rule's expression returned

        Returns:
            TestCaseResult: the verdict, with passed/failed rows when the row count was computed
        """
        row_count = self._run_row_count() if self._needs_row_count() else None
        matched = self._apply_row_threshold(violations, row_count)
        message = f"{subject}: " + result_messages.violation_sentence(
            violations,
            row_count,
            VIOLATION_NOUN,
            self.get_failure_threshold(),
            matched,
        )

        # The rule's SQL is free to join or fan out, so it can return more rows than the table
        # holds. Passed rows would then go negative; leave the row split unreported instead.
        reportable = row_count is not None and violations <= row_count

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(matched),
            message,
            [TestResultValue(name="Row Count", value=str(violations), predictedValue=None)],
            row_count=row_count if reportable else None,
            failed_rows=violations if reportable else None,
        )

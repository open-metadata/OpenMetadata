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

"""Execution provenance survives the quality runtime-parameter boundary."""

from types import SimpleNamespace
from uuid import UUID

import pytest

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.data_quality.validations.runtime_param_setter.evaluation_scope_params_setter import (
    EvaluationScopeParamsSetter,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.tableExecutionSource import TableExecutionSource


class ResultValidator(BaseTestValidator):
    status = TestCaseStatus.Success

    def _run_validation(self):
        return TestCaseResult(timestamp=self.execution_date, testCaseStatus=self.status, result="checked")


def execute(source, *, query=None, bypass=False, status=TestCaseStatus.Success):
    reference = {"id": str(UUID(int=1)), "type": "testDefinition"}
    case = TestCase(
        name="row_count",
        entityLink="<#E::table::demo.demo_db.demo_schema.events_yyyymmdd>",
        testDefinition=reference,
        testSuite={**reference, "type": "testSuite"},
    )
    sampler = SimpleNamespace(execution_source=source, sample_query=query)
    runtime = EvaluationScopeParamsSetter(None, None, None, sampler).get_parameters(case)
    case.parameterValues = [TestCaseParameterValue(name=type(runtime).__name__, value=runtime.model_dump_json())]
    validator = ResultValidator(None, case, 1767225600000)
    validator.BYPASSES_SAMPLER = bypass
    validator.status = status
    return TestCaseResult.model_validate_json(validator.run_validation().model_dump_json())


def physical(day):
    return TableExecutionSource(
        databaseName="demo_db", schemaName="demo_schema", tableName=f"events_2026010{day}", shardDate=f"2026-01-0{day}"
    )


def test_quality_history_keeps_each_runs_physical_source():
    older = execute(physical(1))
    newer = execute(physical(2))
    assert older.evaluationScope.executionSource == physical(1)
    assert newer.evaluationScope.executionSource == physical(2)
    assert older.result == newer.result == "checked"
    assert older.testCaseStatus == newer.testCaseStatus == TestCaseStatus.Success


@pytest.mark.parametrize(
    "kwargs",
    [
        {"source": None},
        {"source": physical(1), "query": "SELECT * FROM ordinary"},
        {"source": physical(1), "bypass": True},
        {"source": physical(1), "status": TestCaseStatus.Aborted},
    ],
)
def test_quality_does_not_claim_representative_execution_without_it(kwargs):
    result = execute(**kwargs)
    assert result.evaluationScope is None
    assert result.result == "checked"
    assert result.testCaseStatus == kwargs.get("status", TestCaseStatus.Success)

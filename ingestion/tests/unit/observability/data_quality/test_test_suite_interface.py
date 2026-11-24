#  Copyright 2026 Collate
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
Duration and error details recorded by TestSuiteInterface.run_test_case.
"""

from datetime import datetime
from unittest.mock import MagicMock
from uuid import uuid4

from pydantic import BaseModel

from metadata.data_quality.builders.validator_builder import ValidatorBuilder
from metadata.data_quality.interface import test_suite_interface
from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.data_quality.validations.runtime_param_setter.param_setter import (
    RuntimeParameterSetter,
)
from metadata.data_quality.validations.runtime_param_setter.param_setter_factory import (
    RuntimeParameterSetterFactory,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus, TestResultValue
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import EntityType, TestDefinition
from metadata.generated.schema.type.entityReference import EntityReference

ENTITY_LINK = "<#E::table::service.database.schema.orders>"


class _PassingValidator(BaseTestValidator):
    def _run_validation(self) -> TestCaseResult:
        return TestCaseResult(timestamp=self.execution_date, testCaseStatus=TestCaseStatus.Success, testResultValue=[])

    def _run_dimensional_validation(self) -> list:
        return []

    def get_column(self, column_name=None):
        return None


class _CrashingValidator(_PassingValidator):
    def _run_validation(self) -> TestCaseResult:
        raise ConnectionError("warehouse unreachable")


class _Interface(test_suite_interface.TestSuiteInterface):
    """The validator builder and the OpenMetadata client are the boundaries stubbed here."""

    def __init__(self, validator: BaseTestValidator):
        ometa = MagicMock()
        ometa.get_by_id.return_value = TestDefinition(
            name="customTest", description="custom", entityType=EntityType.TABLE, testPlatforms=["OpenMetadata"]
        )
        ometa.get_by_name.return_value = None
        super().__init__(MagicMock(), ometa, MagicMock(), MagicMock(), MagicMock())
        self._validator = validator

    def _get_validator_builder(self, test_case, entity_type):
        builder = MagicMock()
        builder.validator = self._validator
        return builder


def _test_case() -> TestCase:
    return TestCase(
        name="orders_custom",
        entityLink=ENTITY_LINK,
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),  # type: ignore
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition", fullyQualifiedName="customTest"),  # type: ignore
    )


def _run(validator_class, interface_class=_Interface) -> TestCaseResult:
    test_case = _test_case()
    validator = validator_class(MagicMock(), test_case, int(datetime.now().timestamp() * 1000))
    interface = interface_class(validator)
    interface.sample_data_config = MagicMock(storeSampleData=False)

    return interface.run_test_case(test_case).testCaseResult


def test_a_run_records_its_duration():
    result = _run(_PassingValidator)

    assert result.testCaseStatus is TestCaseStatus.Success
    assert result.duration > 0
    assert result.errorDetails is None


def test_a_validator_that_raises_is_aborted_with_duration_and_error_details():
    result = _run(_CrashingValidator)

    assert result.testCaseStatus is TestCaseStatus.Aborted
    assert "warehouse unreachable" in result.result
    assert result.duration > 0
    assert result.errorDetails.errorType == "ConnectionError"
    assert result.errorDetails.stackTrace.rstrip().endswith("ConnectionError: warehouse unreachable")


_FAILURE_MESSAGE = "Data diff is not supported for sharded tables yet"


class _RaisingSetter(RuntimeParameterSetter):
    def get_parameters(self, test_case) -> BaseModel:
        raise ValueError(_FAILURE_MESSAGE)


class _RaisingSetterFactory(RuntimeParameterSetterFactory):
    setter: type[RuntimeParameterSetter] = _RaisingSetter

    def get_runtime_param_setters(self, name, ometa, service_connection_config, table_entity, sampler):
        return {self.setter(ometa, service_connection_config, table_entity, sampler)}


class _OkParams(BaseModel):
    value: str = "ok"


class _OkSetter(RuntimeParameterSetter):
    def get_parameters(self, test_case) -> BaseModel:
        return _OkParams()


class _OkSetterFactory(_RaisingSetterFactory):
    setter = _OkSetter


class _RealValidatorBuilder(ValidatorBuilder):
    """Bypass the test-case import machinery the constructor needs; only ``set_runtime_params`` runs for real."""

    def __init__(self, test_case, validator):
        self._test_case = test_case
        self._validator = validator


class _RealBuilderInterface(_Interface):
    runtime_params_setter_fact = _RaisingSetterFactory

    def _get_validator_builder(self, test_case, entity_type):
        return _RealValidatorBuilder(test_case, self._validator)


def test_set_runtime_params_failure_is_aborted_with_duration_and_error_details():
    result = _run(_PassingValidator, _RealBuilderInterface)

    assert result.testCaseStatus is TestCaseStatus.Aborted
    assert result.result == f"Error executing customTest - {_FAILURE_MESSAGE}"
    assert result.duration > 0
    assert result.errorDetails is not None
    assert result.errorDetails.errorType == "ValueError"
    assert _FAILURE_MESSAGE in result.errorDetails.message
    assert result.errorDetails.stackTrace.rstrip().endswith(f"ValueError: {_FAILURE_MESSAGE}")


class _RealBuilderOkInterface(_RealBuilderInterface):
    runtime_params_setter_fact = _OkSetterFactory


class _ReadingValidator(_PassingValidator):
    def _run_validation(self) -> TestCaseResult:
        result = super()._run_validation()
        result.testResultValue = [TestResultValue(name="parameter", value=self.get_runtime_parameters(_OkParams).value)]
        return result


def test_set_runtime_params_success_is_consumed_by_validation():
    result = _run(_ReadingValidator, _RealBuilderOkInterface)

    assert result.testCaseStatus is TestCaseStatus.Success
    assert result.testResultValue is not None
    assert result.testResultValue[0].value == "ok"

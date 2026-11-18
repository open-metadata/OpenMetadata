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
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
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


def _run(validator_class) -> TestCaseResult:
    test_case = _test_case()
    validator = validator_class(MagicMock(), test_case, int(datetime.now().timestamp() * 1000))
    interface = _Interface(validator)
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
    """Mirrors ``TableDiffParamsSetter.get_parameters`` on a sharded table."""

    def get_parameters(self, test_case) -> BaseModel:
        raise ValueError(_FAILURE_MESSAGE)


class _RaisingSetterFactory(RuntimeParameterSetterFactory):
    def get_runtime_param_setters(self, name, ometa, service_connection_config, table_entity, sampler):
        return {_RaisingSetter(ometa, service_connection_config, table_entity, sampler)}


class _OkParams(BaseModel):
    value: str = "ok"


class _OkSetter(RuntimeParameterSetter):
    def get_parameters(self, test_case) -> BaseModel:
        return _OkParams()


class _OkSetterFactory(RuntimeParameterSetterFactory):
    def get_runtime_param_setters(self, name, ometa, service_connection_config, table_entity, sampler):
        return {_OkSetter(ometa, service_connection_config, table_entity, sampler)}


class _RealValidatorBuilder(ValidatorBuilder):
    """Bypass the test-case import machinery the constructor needs; only ``set_runtime_params`` runs for real."""

    def __init__(self, test_case, validator):
        self._test_case = test_case
        self._validator = validator


class _RealBuilderInterface(_Interface):
    """Drive the real ``ValidatorBuilder.set_runtime_params`` so a raising ``get_parameters``
    reaches the production code, not a mock of it. Regression guard for the bug introduced in
    #23326: a setter exception must produce an Aborted result, not escape ``run_test_case``.
    """

    runtime_params_setter_fact = _RaisingSetterFactory

    def _get_validator_builder(self, test_case, entity_type):
        return _RealValidatorBuilder(test_case, self._validator)


def _run_with_real_builder(interface, validator_class) -> TestCaseResult:
    test_case = _test_case()
    validator = validator_class(MagicMock(), test_case, int(datetime.now().timestamp() * 1000))
    runner = interface(validator)
    runner.sample_data_config = MagicMock(storeSampleData=False)

    return runner.run_test_case(test_case).testCaseResult


def test_set_runtime_params_failure_is_aborted_with_duration_and_error_details():
    """A setter ``get_parameters`` raising (e.g. sharded table, missing ``table2``) is recorded
    as an Aborted result, not propagated out of ``run_test_case``. The setter runs through the
    real ``ValidatorBuilder.set_runtime_params`` rather than a mock of it.
    """
    result = _run_with_real_builder(_RealBuilderInterface, _PassingValidator)

    assert result.testCaseStatus is TestCaseStatus.Aborted
    assert result.result == f"Error executing customTest - {_FAILURE_MESSAGE}"
    assert result.duration > 0
    assert result.errorDetails is not None
    assert result.errorDetails.errorType == "ValueError"
    assert _FAILURE_MESSAGE in result.errorDetails.message
    assert result.errorDetails.stackTrace.rstrip().endswith(f"ValueError: {_FAILURE_MESSAGE}")


class _RealBuilderOkInterface(_Interface):
    runtime_params_setter_fact = _OkSetterFactory

    def _get_validator_builder(self, test_case, entity_type):
        return _RealValidatorBuilder(test_case, self._validator)


def test_set_runtime_params_success_appends_parameters_and_runs_validation():
    """Regression guard for the success path: the resolved parameters still land on
    ``test_case.parameterValues`` and the validator still runs, so the fix does not break
    the ``set_runtime_params`` -> ``run_validation`` happy path.
    """
    test_case = _test_case()
    validator = _PassingValidator(MagicMock(), test_case, int(datetime.now().timestamp() * 1000))
    interface = _RealBuilderOkInterface(validator)
    interface.sample_data_config = MagicMock(storeSampleData=False)

    result = interface.run_test_case(test_case).testCaseResult

    assert result.testCaseStatus is TestCaseStatus.Success
    assert test_case.parameterValues is not None
    assert len(test_case.parameterValues) == 1
    assert isinstance(test_case.parameterValues[0], TestCaseParameterValue)
    assert test_case.parameterValues[0].name == "_OkParams"


def test_set_runtime_params_runs_before_run_validation():
    """Regression guard against a reordering refactor: ``set_runtime_params`` must run before
    ``run_validation`` so the validator can read the resolved parameters back via
    ``get_runtime_parameters(...)``. Recorded through the real builder and a real validator.
    """
    call_order: list[str] = []

    class _OrderingSetter(RuntimeParameterSetter):
        def get_parameters(self, test_case) -> BaseModel:
            call_order.append("set_runtime_params")
            return _OkParams()

    class _OrderingFactory(RuntimeParameterSetterFactory):
        def get_runtime_param_setters(self, name, ometa, service_connection_config, table_entity, sampler):
            return {_OrderingSetter(ometa, service_connection_config, table_entity, sampler)}

    class _OrderingValidator(_PassingValidator):
        def _run_validation(self) -> TestCaseResult:
            call_order.append("run_validation")
            return super()._run_validation()

    class _OrderingInterface(_Interface):
        runtime_params_setter_fact = _OrderingFactory

        def _get_validator_builder(self, test_case, entity_type):
            return _RealValidatorBuilder(test_case, self._validator)

    test_case = _test_case()
    validator = _OrderingValidator(MagicMock(), test_case, int(datetime.now().timestamp() * 1000))
    interface = _OrderingInterface(validator)
    interface.sample_data_config = MagicMock(storeSampleData=False)

    interface.run_test_case(test_case)

    assert call_order == ["set_runtime_params", "run_validation"]

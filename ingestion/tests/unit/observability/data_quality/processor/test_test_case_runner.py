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
Unit tests for TestCaseRunner processor
"""

from unittest.mock import Mock, patch
from uuid import UUID

import pytest

from metadata.data_quality.processor.test_case_runner import TestCaseRunner
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import TestDefinition, TestPlatform
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.status import Status


def create_test_definition(
    name: str,
    test_platforms: list,
    enabled: bool = True,
    include_enabled_field: bool = True,
) -> TestDefinition:
    """Helper to create TestDefinition with specified platforms and enabled status."""
    definition_id = UUID(int=hash(name) % (10**10))
    definition_data = {
        "id": str(definition_id),
        "name": name,
        "description": f"Test definition for {name}",
        "testPlatforms": test_platforms,
    }
    if include_enabled_field:
        definition_data["enabled"] = enabled
    definition = TestDefinition(**definition_data)
    definition._test_id = definition_id
    return definition


def create_test_case(name: str, definition_id: UUID) -> TestCase:
    """Helper to create TestCase with reference to a TestDefinition."""
    return TestCase(
        id=str(UUID(int=hash(name) % (10**10))),
        name=name,
        testDefinition=EntityReference(
            id=str(definition_id),
            type="testDefinition",
            name="test_definition",
        ),
        testSuite=EntityReference(
            id=str(UUID(int=0)),
            type="testSuite",
            name="test_suite",
        ),
        entityLink="<#E::table::test_table>",
    )


class TestFilterForOMTestCases:
    """Tests for TestCaseRunner.filter_for_om_test_cases method."""

    @pytest.fixture
    def mock_runner(self):
        """Create a TestCaseRunner with mocked dependencies."""
        with patch.object(TestCaseRunner, "__init__", lambda x, **kwargs: None):
            runner = TestCaseRunner()
            runner.metadata = Mock()
            return runner

    def test_filters_out_non_openmetadata_platform(self, mock_runner):
        """Test that test cases with non-OpenMetadata platforms are filtered out."""
        om_definition = create_test_definition(
            name="om_test",
            test_platforms=[TestPlatform.OpenMetadata],
            enabled=True,
        )
        dbt_definition = create_test_definition(
            name="dbt_test",
            test_platforms=[TestPlatform.dbt],
            enabled=True,
        )
        great_expectations_definition = create_test_definition(
            name="ge_test",
            test_platforms=[TestPlatform.GreatExpectations],
            enabled=True,
        )

        om_test_case = create_test_case("om_case", om_definition._test_id)
        dbt_test_case = create_test_case("dbt_case", dbt_definition._test_id)
        ge_test_case = create_test_case("ge_case", great_expectations_definition._test_id)

        def get_by_id_side_effect(entity_type, entity_id, nullable=False):
            # entity_id is a pydantic Uuid wrapper, access .root to get the UUID
            id_str = str(entity_id.root) if hasattr(entity_id, "root") else str(entity_id)
            mapping = {
                str(om_definition._test_id): om_definition,
                str(dbt_definition._test_id): dbt_definition,
                str(great_expectations_definition._test_id): great_expectations_definition,
            }
            return mapping.get(id_str)

        mock_runner.metadata.get_by_id.side_effect = get_by_id_side_effect

        result = mock_runner.filter_for_om_test_cases([om_test_case, dbt_test_case, ge_test_case])

        assert len(result) == 1
        assert result[0].name.root == "om_case"

    def test_filters_out_disabled_test_definitions(self, mock_runner):
        """Test that test cases with disabled TestDefinitions are filtered out."""
        enabled_definition = create_test_definition(
            name="enabled_test",
            test_platforms=[TestPlatform.OpenMetadata],
            enabled=True,
        )
        disabled_definition = create_test_definition(
            name="disabled_test",
            test_platforms=[TestPlatform.OpenMetadata],
            enabled=False,
        )

        enabled_test_case = create_test_case("enabled_case", enabled_definition._test_id)
        disabled_test_case = create_test_case("disabled_case", disabled_definition._test_id)

        def get_by_id_side_effect(entity_type, entity_id, nullable=False):
            id_str = str(entity_id.root) if hasattr(entity_id, "root") else str(entity_id)
            mapping = {
                str(enabled_definition._test_id): enabled_definition,
                str(disabled_definition._test_id): disabled_definition,
            }
            return mapping.get(id_str)

        mock_runner.metadata.get_by_id.side_effect = get_by_id_side_effect

        result = mock_runner.filter_for_om_test_cases([enabled_test_case, disabled_test_case])

        assert len(result) == 1
        assert result[0].name.root == "enabled_case"

    def test_missing_enabled_field_defaults_to_true(self, mock_runner):
        """Test that TestDefinitions without enabled field default to enabled=True."""
        definition_without_enabled = create_test_definition(
            name="legacy_test",
            test_platforms=[TestPlatform.OpenMetadata],
            include_enabled_field=False,
        )

        test_case = create_test_case("legacy_case", definition_without_enabled._test_id)

        mock_runner.metadata.get_by_id.return_value = definition_without_enabled

        result = mock_runner.filter_for_om_test_cases([test_case])

        assert len(result) == 1
        assert result[0].name.root == "legacy_case"

    def test_multi_platform_with_openmetadata_passes(self, mock_runner):
        """Test that definitions with multiple platforms including OpenMetadata pass."""
        multi_platform_definition = create_test_definition(
            name="multi_platform_test",
            test_platforms=[TestPlatform.OpenMetadata, TestPlatform.dbt],
            enabled=True,
        )

        test_case = create_test_case("multi_platform_case", multi_platform_definition._test_id)

        mock_runner.metadata.get_by_id.return_value = multi_platform_definition

        result = mock_runner.filter_for_om_test_cases([test_case])

        assert len(result) == 1
        assert result[0].name.root == "multi_platform_case"

    def test_non_openmetadata_and_disabled_both_filtered(self, mock_runner):
        """Test that both non-OpenMetadata platform AND disabled definitions are filtered."""
        om_enabled = create_test_definition(
            name="om_enabled",
            test_platforms=[TestPlatform.OpenMetadata],
            enabled=True,
        )
        om_disabled = create_test_definition(
            name="om_disabled",
            test_platforms=[TestPlatform.OpenMetadata],
            enabled=False,
        )
        dbt_enabled = create_test_definition(
            name="dbt_enabled",
            test_platforms=[TestPlatform.dbt],
            enabled=True,
        )
        dbt_disabled = create_test_definition(
            name="dbt_disabled",
            test_platforms=[TestPlatform.dbt],
            enabled=False,
        )

        test_cases = [
            create_test_case("case_om_enabled", om_enabled._test_id),
            create_test_case("case_om_disabled", om_disabled._test_id),
            create_test_case("case_dbt_enabled", dbt_enabled._test_id),
            create_test_case("case_dbt_disabled", dbt_disabled._test_id),
        ]

        def get_by_id_side_effect(entity_type, entity_id, nullable=False):
            id_str = str(entity_id.root) if hasattr(entity_id, "root") else str(entity_id)
            mapping = {
                str(om_enabled._test_id): om_enabled,
                str(om_disabled._test_id): om_disabled,
                str(dbt_enabled._test_id): dbt_enabled,
                str(dbt_disabled._test_id): dbt_disabled,
            }
            return mapping.get(id_str)

        mock_runner.metadata.get_by_id.side_effect = get_by_id_side_effect

        result = mock_runner.filter_for_om_test_cases(test_cases)

        assert len(result) == 1
        assert result[0].name.root == "case_om_enabled"

    def test_empty_test_cases_returns_empty(self, mock_runner):
        """Test that empty input returns empty output."""
        result = mock_runner.filter_for_om_test_cases([])

        assert result == []
        mock_runner.metadata.get_by_id.assert_not_called()

    def test_all_filtered_returns_empty(self, mock_runner):
        """Test that when all test cases are filtered, empty list is returned."""
        disabled_definition = create_test_definition(
            name="disabled_test",
            test_platforms=[TestPlatform.OpenMetadata],
            enabled=False,
        )

        test_case = create_test_case("disabled_case", disabled_definition._test_id)

        mock_runner.metadata.get_by_id.return_value = disabled_definition

        result = mock_runner.filter_for_om_test_cases([test_case])

        assert result == []

    @pytest.mark.parametrize(
        "platform",
        [
            TestPlatform.GreatExpectations,
            TestPlatform.dbt,
            TestPlatform.Deequ,
            TestPlatform.Soda,
            TestPlatform.Other,
        ],
    )
    def test_each_non_openmetadata_platform_filtered(self, mock_runner, platform):
        """Test that each non-OpenMetadata platform is correctly filtered out."""
        definition = create_test_definition(
            name=f"{platform.value}_test",
            test_platforms=[platform],
            enabled=True,
        )

        test_case = create_test_case(f"{platform.value}_case", definition._test_id)

        mock_runner.metadata.get_by_id.return_value = definition

        result = mock_runner.filter_for_om_test_cases([test_case])

        assert len(result) == 0


def _result(status: TestCaseStatus | None, message: str | None = "boom") -> Mock:
    """A TestCaseResultResponse carrying one result, as run_and_handle returns."""
    response = Mock()
    response.testCaseResult = TestCaseResult(
        timestamp=1234567890000,
        testCaseStatus=status,
        result=message,
    )
    return response


class TestAbortedTestCasesAreCounted:
    """A test that could not be evaluated must not leave the step reporting success.

    Validations return TestCaseStatus.Aborted rather than raising when they cannot
    run, so without this the step sees only scanned records and a run in which no
    test executed reports zero errors and 100% success.
    """

    @pytest.fixture
    def runner(self):
        # A real instance with a stubbed status, rather than a Mock with methods
        # bound onto it: the methods under test then run for real, so a
        # regression shows up as a failed assertion rather than as a missing
        # attribute on the mock.
        runner = TestCaseRunner.__new__(TestCaseRunner)
        runner.status = Mock()
        return runner

    def test_aborted_result_is_recorded_as_a_failure(self, runner):
        test_case = create_test_case("aborted_case", UUID(int=1))
        test_case.fullyQualifiedName = Mock(root="svc.db.schema.table.aborted_case")
        suite_runner = Mock()
        suite_runner.run_and_handle.return_value = _result(TestCaseStatus.Aborted, "Login failed")

        result = runner._run_test_case(test_case, suite_runner)

        assert result is not None, "the aborted result still goes to the sink"
        runner.status.scanned.assert_not_called()
        runner.status.failed.assert_called_once()
        assert "Login failed" in runner.status.failed.call_args[0][0].error

    @pytest.mark.parametrize("status", [TestCaseStatus.Success, TestCaseStatus.Failed, TestCaseStatus.Queued])
    def test_a_reported_status_other_than_aborted_is_not_a_step_failure(self, runner, status):
        """A Failed test case is a data problem, not an execution error."""
        test_case = create_test_case(f"{status.value}_case", UUID(int=2))
        test_case.fullyQualifiedName = Mock(root=f"svc.db.schema.table.{status.value}")
        suite_runner = Mock()
        suite_runner.run_and_handle.return_value = _result(status)

        runner._run_test_case(test_case, suite_runner)

        runner.status.scanned.assert_called_once()
        runner.status.failed.assert_not_called()

    def test_missing_result_is_not_a_failure(self, runner):
        test_case = create_test_case("no_result_case", UUID(int=3))
        test_case.fullyQualifiedName = Mock(root="svc.db.schema.table.no_result")
        suite_runner = Mock()
        suite_runner.run_and_handle.return_value = None

        runner._run_test_case(test_case, suite_runner)

        runner.status.scanned.assert_called_once()
        runner.status.failed.assert_not_called()

    def test_a_raising_runner_is_a_failure_and_is_not_scanned(self, runner):
        """The other way a case produces no usable result, and the same accounting."""
        test_case = create_test_case("raising_case", UUID(int=4))
        test_case.fullyQualifiedName = Mock(root="svc.db.schema.table.raising")
        suite_runner = Mock()
        suite_runner.run_and_handle.side_effect = RuntimeError("connection reset")

        result = runner._run_test_case(test_case, suite_runner)

        assert result is None
        runner.status.scanned.assert_not_called()
        runner.status.failed.assert_called_once()
        failure = runner.status.failed.call_args[0][0]
        assert "connection reset" in failure.error
        assert failure.stackTrace, "a raised error carries its traceback"

    def test_aborted_without_a_message_falls_back_to_a_default(self, runner):
        """``TestCaseResult.result`` is optional, so the error cannot just be passed through."""
        test_case = create_test_case("silent_abort", UUID(int=5))
        test_case.fullyQualifiedName = Mock(root="svc.db.schema.table.silent_abort")
        suite_runner = Mock()
        suite_runner.run_and_handle.return_value = _result(TestCaseStatus.Aborted, None)

        runner._run_test_case(test_case, suite_runner)

        assert runner.status.failed.call_args[0][0].error == "Test case silent_abort was aborted"

    def test_a_result_without_a_status_is_not_treated_as_aborted(self, runner):
        """``testCaseStatus`` is optional too; only an explicit Aborted counts."""
        test_case = create_test_case("no_status_case", UUID(int=6))
        test_case.fullyQualifiedName = Mock(root="svc.db.schema.table.no_status")
        suite_runner = Mock()
        suite_runner.run_and_handle.return_value = _result(None, "no status reported")

        runner._run_test_case(test_case, suite_runner)

        runner.status.scanned.assert_called_once()
        runner.status.failed.assert_not_called()


class TestAbortedCasesDoNotInflateTheSuccessRate:
    """The ratio itself, on a real Status rather than a mock.

    ``calculate_success`` divides the scanned records by themselves plus the
    failures, so an aborted case counted as both lands on each side and pulls the
    percentage up. These assert the number a run actually reports.
    """

    @staticmethod
    def _run(statuses: list[TestCaseStatus]) -> Status:
        runner = TestCaseRunner.__new__(TestCaseRunner)
        runner.status = Status()
        suite_runner = Mock()
        suite_runner.run_and_handle.side_effect = [_result(status) for status in statuses]

        for index in range(len(statuses)):
            test_case = create_test_case(f"case_{index}", UUID(int=index))
            test_case.fullyQualifiedName = Mock(root=f"svc.db.schema.table.case_{index}")
            runner._run_test_case(test_case, suite_runner)

        return runner.status

    def test_half_aborted_reports_half_success(self):
        status = self._run([TestCaseStatus.Aborted] * 5 + [TestCaseStatus.Success] * 5)

        assert len(status.records) == 5
        assert len(status.failures) == 5
        assert status.calculate_success() == 50.0

    def test_a_failed_test_case_is_not_a_step_failure(self):
        """A Failed test case is a data problem: it ran, so the step still succeeded."""
        status = self._run([TestCaseStatus.Failed] * 4)

        assert len(status.records) == 4
        assert status.failures == []
        assert status.calculate_success() == 100.0

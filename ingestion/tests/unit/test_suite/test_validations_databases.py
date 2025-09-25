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
Test Table and Column Tests' validate implementations.

Each test should validate the Success, Failure and Aborted statuses
"""
from datetime import date, datetime
from unittest.mock import patch

import pytest

from metadata.data_quality.validations.models import (
    TableCustomSQLQueryRuntimeParameters,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.utils.importer import import_test_case_class

EXECUTION_DATE = datetime.strptime("2021-07-03", "%Y-%m-%d")

TEST_CASE_SUPPORT_ROW_LEVEL_PASS_FAILED = {
    "columnValuesLengthToBeBetween",
    "columnValuesToBeBetween",
    "columnValuesToBeInSet",
    "columnValuesToBeNotInSet",
    "columnValuesToBeNotNull",
    "columnValuesToBeUnique",
    "columnValuesToMatchRegex",
    "columnValuesToNotMatchRegex",
    "tableCustomSQLQuery",
}

# pylint: disable=line-too-long
@pytest.mark.parametrize(
    "test_case_name,test_case_type,test_type,expected",
    [
        (
            "test_case_column_values_to_be_between_date",
            "columnValuesToBeBetween",
            "COLUMN",
            (
                TestCaseResult,
                "2021-07-01 00:00:00",
                "2021-07-01 23:59:59.999999",
                TestCaseStatus.Failed,
                0.0,
                30.0,
                0.0,
                100.0,
            ),
        ),
        (
            "test_case_column_values_to_be_between_datetime",
            "columnValuesToBeBetween",
            "COLUMN",
            (
                TestCaseResult,
                "2021-07-01 10:37:59",
                "2021-07-01 10:37:59",
                TestCaseStatus.Success,
                None,
                None,
                None,
                None,
            ),
        ),
        (
            "test_case_column_value_length_to_be_between",
            "columnValueLengthsToBeBetween",
            "COLUMN",
            (
                TestCaseResult,
                "0",
                "8",
                TestCaseStatus.Failed,
                20.0,
                10.0,
                66.67,
                33.33,
            ),
        ),
        (
            "test_case_column_value_length_to_be_between_col_space",
            "columnValueLengthsToBeBetween",
            "COLUMN",
            (TestCaseResult, "2", "3", TestCaseStatus.Success, 30.0, 0.0, 100.0, 0.0),
        ),
        (
            "test_case_column_value_length_to_be_between_no_min",
            "columnValueLengthsToBeBetween",
            "COLUMN",
            (TestCaseResult, None, None, TestCaseStatus.Success, 30.0, 0.0, 100.0, 0.0),
        ),
        (
            "test_case_column_value_max_to_be_between",
            "columnValueMaxToBeBetween",
            "COLUMN",
            (TestCaseResult, "31", None, TestCaseStatus.Failed, None, None, None, None),
        ),
        (
            "test_case_column_value_max_to_be_between_no_min",
            "columnValueMaxToBeBetween",
            "COLUMN",
            (TestCaseResult, None, None, TestCaseStatus.Failed, None, None, None, None),
        ),
        (
            "test_case_column_value_mean_to_be_between",
            "columnValueMeanToBeBetween",
            "COLUMN",
            (
                TestCaseResult,
                "30.5",
                None,
                TestCaseStatus.Failed,
                None,
                None,
                None,
                None,
            ),
        ),
        (
            "test_case_column_value_mean_to_be_between_no_max",
            "columnValueMeanToBeBetween",
            "COLUMN",
            (
                TestCaseResult,
                None,
                None,
                TestCaseStatus.Success,
                None,
                None,
                None,
                None,
            ),
        ),
        (
            "test_case_column_value_median_to_be_between",
            "columnValueMedianToBeBetween",
            "COLUMN",
            (TestCaseResult, "30", None, TestCaseStatus.Failed, None, None, None, None),
        ),
        (
            "test_case_column_value_min_to_be_between",
            "columnValueMinToBeBetween",
            "COLUMN",
            (
                TestCaseResult,
                "30",
                None,
                TestCaseStatus.Success,
                None,
                None,
                None,
                None,
            ),
        ),
        (
            "test_case_column_value_min_to_be_between_no_min",
            "columnValueMinToBeBetween",
            "COLUMN",
            (
                TestCaseResult,
                None,
                None,
                TestCaseStatus.Success,
                None,
                None,
                None,
                None,
            ),
        ),
        (
            "test_case_column_value_stddev_to_be_between",
            "columnValueStdDevToBeBetween",
            "COLUMN",
            (
                TestCaseResult,
                "0.25",
                None,
                TestCaseStatus.Failed,
                None,
                None,
                None,
                None,
            ),
        ),
        (
            "test_case_column_value_stddev_to_be_between_no_min",
            "columnValueStdDevToBeBetween",
            "COLUMN",
            (
                TestCaseResult,
                None,
                None,
                TestCaseStatus.Success,
                None,
                None,
                None,
                None,
            ),
        ),
        (
            "test_case_column_value_in_set",
            "columnValuesToBeInSet",
            "COLUMN",
            (
                TestCaseResult,
                "20",
                None,
                TestCaseStatus.Success,
                20.0,
                10.0,
                66.67,
                33.33,
            ),
        ),
        (
            "test_case_column_values_missing_count_to_be_equal",
            "columnValuesMissingCount",
            "COLUMN",
            (
                TestCaseResult,
                "20",
                None,
                TestCaseStatus.Failed,
                None,
                None,
                None,
                None,
            ),
        ),
        (
            "test_case_column_values_missing_count_to_be_equal_missing_values",
            "columnValuesMissingCount",
            "COLUMN",
            (TestCaseResult, "30", None, TestCaseStatus.Failed, None, None, None, None),
        ),
        (
            "test_case_column_values_not_in_set",
            "columnValuesToBeNotInSet",
            "COLUMN",
            (
                TestCaseResult,
                "20",
                None,
                TestCaseStatus.Failed,
                10.0,
                20.0,
                33.33,
                66.67,
            ),
        ),
        (
            "test_case_column_sum_to_be_between",
            "columnValuesSumToBeBetween",
            "COLUMN",
            (
                TestCaseResult,
                "610",
                None,
                TestCaseStatus.Failed,
                None,
                None,
                None,
                None,
            ),
        ),
        (
            "test_case_column_values_to_be_between",
            "columnValuesToBeBetween",
            "COLUMN",
            (TestCaseResult, "30", None, TestCaseStatus.Success, 30.0, 0.0, 100.0, 0.0),
        ),
        (
            "test_case_column_values_to_be_not_null",
            "columnValuesToBeNotNull",
            "COLUMN",
            (
                TestCaseResult,
                "10",
                None,
                TestCaseStatus.Failed,
                20.0,
                10.0,
                66.67,
                33.33,
            ),
        ),
        (
            "test_case_column_values_to_be_unique",
            "columnValuesToBeUnique",
            "COLUMN",
            (TestCaseResult, "20", "0", TestCaseStatus.Failed, 0.0, 20.0, 0.0, 100.0),
        ),
        (
            "test_case_column_values_to_match_regex",
            "columnValuesToMatchRegex",
            "COLUMN",
            (TestCaseResult, "30", None, TestCaseStatus.Success, 30.0, 0.0, 100.0, 0.0),
        ),
        (
            "test_case_column_values_to_not_match_regex",
            "columnValuesToNotMatchRegex",
            "COLUMN",
            (TestCaseResult, "0", None, TestCaseStatus.Success, 30.0, 0.0, 100.0, 0.0),
        ),
        (
            "test_case_table_column_count_to_be_between",
            "tableColumnCountToBeBetween",
            "TABLE",
            (
                TestCaseResult,
                "11",
                None,
                TestCaseStatus.Success,
                None,
                None,
                None,
                None,
            ),
        ),
        (
            "test_case_table_column_count_to_equal",
            "tableColumnCountToEqual",
            "TABLE",
            (TestCaseResult, "11", None, TestCaseStatus.Failed, None, None, None, None),
        ),
        (
            "test_case_table_column_name_to_exist",
            "tableColumnNameToExist",
            "TABLE",
            (TestCaseResult, "1", None, TestCaseStatus.Success, None, None, None, None),
        ),
        (
            "test_case_column_to_match_set",
            "tableColumnToMatchSet",
            "TABLE",
            (
                TestCaseResult,
                "0",
                None,
                TestCaseStatus.Failed,
                None,
                None,
                None,
                None,
            ),
        ),
        (
            "test_case_column_to_match_set_ordered",
            "tableColumnToMatchSet",
            "TABLE",
            (TestCaseResult, None, None, TestCaseStatus.Failed, None, None, None, None),
        ),
        (
            "test_case_table_custom_sql_query",
            "tableCustomSQLQuery",
            "TABLE",
            (TestCaseResult, "20", None, TestCaseStatus.Failed, None, None, None, None),
        ),
        (
            "test_case_table_custom_sql_query_success",
            "tableCustomSQLQuery",
            "TABLE",
            (TestCaseResult, "0", None, TestCaseStatus.Success, None, None, None, None),
        ),
        (
            "test_case_table_custom_sql_with_partition_condition",
            "tableCustomSQLQuery",
            "TABLE",
            (TestCaseResult, "10", None, TestCaseStatus.Failed, 10, 10, 50.0, 50.0),
        ),
        (
            "test_case_table_row_count_to_be_between",
            "tableRowCountToBeBetween",
            "TABLE",
            (
                TestCaseResult,
                "30",
                None,
                TestCaseStatus.Success,
                None,
                None,
                None,
                None,
            ),
        ),
        (
            "test_case_table_row_count_to_be_equal",
            "tableRowCountToEqual",
            "TABLE",
            (TestCaseResult, "30", None, TestCaseStatus.Failed, None, None, None, None),
        ),
        (
            "test_case_table_row_inserted_count_to_be_between",
            "tableRowInsertedCountToBeBetween",
            "TABLE",
            (TestCaseResult, "6", None, TestCaseStatus.Success, None, None, None, None),
        ),
        (
            "test_case_table_custom_sql_query_with_threshold_success",
            "tableCustomSQLQuery",
            "TABLE",
            (
                TestCaseResult,
                "10",
                None,
                TestCaseStatus.Success,
                None,
                None,
                None,
                None,
            ),
        ),
        (
            "test_case_table_custom_sql_unsafe_query_aborted",
            "tableCustomSQLQuery",
            "TABLE",
            (
                TestCaseResult,
                None,
                None,
                TestCaseStatus.Aborted,
                None,
                None,
                None,
                None,
            ),
        ),
        (
            "test_case_column_values_to_be_at_expected_location",
            "columnValuesToBeAtExpectedLocation",
            "COLUMN",
            (
                TestCaseResult,
                "30",
                "0",
                TestCaseStatus.Success,
                None,
                None,
                None,
                None,
            ),
        ),
        (
            "test_case_column_value_in_set_boolean",
            "columnValuesToBeInSet",
            "COLUMN",
            (TestCaseResult, "20", None, TestCaseStatus.Success, 20.0, 0.0, 66.67, 0.0),
        ),
    ],
)
def test_suite_validation_database(
    test_case_name,
    test_case_type,
    test_type,
    expected,
    request,
    create_sqlite_table,
):
    """Generic test runner for test validations"""
    test_case = request.getfixturevalue(test_case_name)
    (
        type_,
        val_1,
        val_2,
        status,
        passed_rows,
        failed_rows,
        passed_percentage,
        failed_percentage,
    ) = expected

    if test_case_type in TEST_CASE_SUPPORT_ROW_LEVEL_PASS_FAILED:
        test_case.computePassedFailedRowCount = True
    if test_case_type == "tableCustomSQLQuery":
        runtime_params = TableCustomSQLQueryRuntimeParameters(
            conn_config=DatabaseConnection(
                config=create_sqlite_table.service_connection,
            ),
            entity=create_sqlite_table.entity,
        )
        test_case.parameterValues.append(
            TestCaseParameterValue(
                name=TableCustomSQLQueryRuntimeParameters.__name__,
                value=runtime_params.model_dump_json(),
            )
        )

    if test_case_name == "test_case_column_values_to_be_between_date":
        with patch(
            "metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeBetween.ColumnValuesToBeBetweenValidator._run_results",
            return_value=date(2021, 7, 1),
        ):
            test_handler_obj = import_test_case_class(
                test_type,
                "sqlalchemy",
                test_case_type,
            )

            test_handler = test_handler_obj(
                create_sqlite_table,
                test_case=test_case,
                execution_date=EXECUTION_DATE.timestamp(),
            )

            res = test_handler.run_validation()
    elif test_case_name == "test_case_column_values_to_be_between_datetime":
        with patch(
            "metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeBetween.ColumnValuesToBeBetweenValidator._run_results",
            return_value=datetime(2021, 7, 1, 10, 37, 59),
        ):
            test_handler_obj = import_test_case_class(
                test_type,
                "sqlalchemy",
                test_case_type,
            )

            test_handler = test_handler_obj(
                create_sqlite_table,
                test_case=test_case,
                execution_date=EXECUTION_DATE.timestamp(),
            )

            res = test_handler.run_validation()
    else:
        test_handler_obj = import_test_case_class(
            test_type,
            "sqlalchemy",
            test_case_type,
        )

        test_handler = test_handler_obj(
            create_sqlite_table,
            test_case=test_case,
            execution_date=EXECUTION_DATE.timestamp(),
        )

        res = test_handler.run_validation()

    assert isinstance(res, type_)
    if val_1:
        assert res.testResultValue[0].value == val_1
    if val_2:
        assert res.testResultValue[1].value == val_2
    if passed_rows:
        assert res.passedRows == passed_rows
    if failed_rows:
        assert res.failedRows == failed_rows
    if passed_percentage:
        assert round(res.passedRowsPercentage, 2) == passed_percentage
    if failed_percentage:
        assert round(res.failedRowsPercentage, 2) == failed_percentage
    assert res.testCaseStatus == status
    if (
        test_case_type in TEST_CASE_SUPPORT_ROW_LEVEL_PASS_FAILED
        and test_case_name != "test_case_table_custom_sql_unsafe_query_aborted"
    ):
        assert res.failedRows is not None
        assert res.failedRowsPercentage is not None
        assert res.passedRows is not None
        assert res.passedRowsPercentage is not None


# Test cases for dimensional validation
def test_column_values_to_be_in_set_backward_compatibility(create_sqlite_table):
    """Test backward compatibility: non-dimensional ColumnValuesToBeInSet still works"""
    from uuid import uuid4

    from metadata.generated.schema.type.entityReference import EntityReference

    test_case = TestCase(
        name="test_dimensional_backward_compatibility",
        entityLink="<#E::table::service.db.users::columns::nickname>",
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),  # type: ignore
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),  # type: ignore
        parameterValues=[
            TestCaseParameterValue(
                name="allowedValues", value='["john", "jane", "bob"]'
            ),
            TestCaseParameterValue(name="matchEnum", value="false"),
        ],
        # No dimensionColumns - this should work exactly as before
    )

    test_handler_obj = import_test_case_class(
        "COLUMN",
        "sqlalchemy",
        "columnValuesToBeInSet",
    )

    test_handler = test_handler_obj(
        create_sqlite_table,
        test_case=test_case,
        execution_date=EXECUTION_DATE.timestamp(),
    )

    # Verify this is not a dimensional test
    assert not test_handler.is_dimensional_test()

    # Mock the query result
    with patch.object(test_handler, "_run_results", return_value=25):
        res = test_handler.run_validation()

    # Verify standard behavior
    assert isinstance(res, TestCaseResult)
    assert res.testCaseStatus in [TestCaseStatus.Success, TestCaseStatus.Failed]
    assert res.dimensionResults is None  # No dimensional results
    assert len(res.testResultValue) == 1
    assert res.testResultValue[0].name == "allowedValueCount"


def test_column_values_to_be_in_set_dimensional_validation(create_sqlite_table):
    """Test dimensional validation functionality"""
    from uuid import uuid4

    from metadata.generated.schema.type.entityReference import EntityReference

    test_case = TestCase(
        id=uuid4(),
        name="my_test_case",
        fullyQualifiedName="my_test_case_fqn",
        entityLink="<#E::table::service.db.users::columns::nickname>",
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),  # type: ignore
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),  # type: ignore
        parameterValues=[
            TestCaseParameterValue(
                name="allowedValues", value='["john", "jane", "bob"]'
            ),
            TestCaseParameterValue(name="matchEnum", value="false"),
        ],
        dimensionColumns=["name"],  # Enable dimensional analysis on name column
        computePassedFailedRowCount=True,
    )  # type: ignore

    test_handler_obj = import_test_case_class(
        "COLUMN",
        "sqlalchemy",
        "columnValuesToBeInSet",
    )

    test_handler = test_handler_obj(
        create_sqlite_table,
        test_case=test_case,
        execution_date=EXECUTION_DATE.timestamp(),
    )

    # Verify this is a dimensional test
    assert test_handler.is_dimensional_test()

    # Mock the main query result and dimensional query results
    # Simulate realistic data: John and Jane are in the allowed set, Alice is not
    mock_dimensional_data = [
        {
            "dimension_value": "John",
            "count_in_set": 2,
            "impact_score": 0.3,
        },  # 2 Johns in allowed set
        {
            "dimension_value": "Jane",
            "count_in_set": 1,
            "impact_score": 0.15,
        },  # 1 Jane in allowed set
        {
            "dimension_value": "Alice",
            "count_in_set": 0,
            "impact_score": 0.0,
        },  # Alice not in allowed set
    ]

    with patch.object(test_handler, "_run_results", return_value=23), patch.object(
        test_handler,
        "_execute_with_others_aggregation",
        return_value=mock_dimensional_data,
    ), patch.object(test_handler, "_get_column_name") as mock_get_column:

        # Mock column objects with required attributes for COUNT_IN_SET metric
        from unittest.mock import MagicMock

        from sqlalchemy import Column, String

        # Create proper SQLAlchemy Column mocks
        mock_main_column = MagicMock(spec=Column)
        mock_main_column.name = "nickname"
        mock_main_column.type = String()
        mock_main_column.label = MagicMock(
            return_value=mock_main_column
        )  # Add label method

        mock_name_column = MagicMock(spec=Column)
        mock_name_column.name = "name"
        mock_name_column.type = String()
        mock_name_column.label = MagicMock(
            return_value=mock_name_column
        )  # Add label method

        def mock_get_column_side_effect(column_name=None):
            if column_name == "name":
                return mock_name_column
            return mock_main_column

        mock_get_column.side_effect = mock_get_column_side_effect

        res = test_handler.run_validation()

    # Verify main test result
    assert isinstance(res, TestCaseResult)
    assert res.testCaseStatus in [TestCaseStatus.Success, TestCaseStatus.Failed]
    assert len(res.testResultValue) == 1
    assert res.testResultValue[0].name == "allowedValueCount"

    # Verify dimensional results exist
    assert res.dimensionResults is not None
    assert len(res.dimensionResults) == 3  # Three dimension values: John, Jane, Alice

    # Create a map for easier verification
    dimension_results_map = {
        dr.dimensionValues[0].value: dr for dr in res.dimensionResults
    }

    # Verify John's results (2 matches - should pass)
    john_result = dimension_results_map["John"]
    assert john_result.dimensionKey == "name=John"
    assert (
        john_result.testCaseStatus == TestCaseStatus.Success
    )  # Has matches, so success
    assert john_result.passedRows == 2  # 2 Johns in allowed set
    assert john_result.failedRows == 0  # No failures for non-enum mode
    assert john_result.testResultValue[0].value == "2"  # count_in_set = 2

    # Verify Jane's results (1 match - should pass)
    jane_result = dimension_results_map["Jane"]
    assert jane_result.dimensionKey == "name=Jane"
    assert (
        jane_result.testCaseStatus == TestCaseStatus.Success
    )  # Has matches, so success
    assert jane_result.passedRows == 1  # 1 Jane in allowed set
    assert jane_result.failedRows == 0  # No failures for non-enum mode
    assert jane_result.testResultValue[0].value == "1"  # count_in_set = 1

    # Verify Alice's results (0 matches - should fail)
    alice_result = dimension_results_map["Alice"]
    assert alice_result.dimensionKey == "name=Alice"
    assert alice_result.testCaseStatus == TestCaseStatus.Failed  # No matches, so failed
    assert alice_result.passedRows == 0  # 0 Alices in allowed set
    assert alice_result.failedRows == 0  # No failures tracked in non-enum mode
    assert alice_result.testResultValue[0].value == "0"  # count_in_set = 0


def test_column_values_to_be_in_set_invalid_dimension_column(create_sqlite_table):
    """Test error handling for invalid dimension columns"""
    from uuid import uuid4

    from metadata.generated.schema.type.entityReference import EntityReference

    test_case = TestCase(
        name="test_invalid_dimension_column",
        entityLink="<#E::table::service.db.users::columns::nickname>",
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),  # type: ignore
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),  # type: ignore
        parameterValues=[
            TestCaseParameterValue(
                name="allowedValues", value='["john", "jane", "bob"]'
            ),
        ],
        dimensionColumns=["invalid_column"],  # Invalid dimension column
    )

    test_handler_obj = import_test_case_class(
        "COLUMN",
        "sqlalchemy",
        "columnValuesToBeInSet",
    )

    test_handler = test_handler_obj(
        create_sqlite_table,
        test_case=test_case,
        execution_date=EXECUTION_DATE.timestamp(),
    )

    # Verify this is a dimensional test
    assert test_handler.is_dimensional_test()

    # Mock column resolution to raise ValueError for invalid column
    with patch.object(test_handler, "_run_results", return_value=23), patch.object(
        test_handler, "_get_column_name"
    ) as mock_get_column:

        # Mock main column resolution
        from unittest.mock import MagicMock

        from sqlalchemy import Column, String

        mock_main_column = MagicMock(spec=Column)
        mock_main_column.name = "nickname"
        mock_main_column.type = String()
        mock_get_column.return_value = mock_main_column

        res = test_handler.run_validation()

    # Main test should still succeed even when dimension columns are invalid
    assert isinstance(res, TestCaseResult)
    assert res.testCaseStatus == TestCaseStatus.Success  # Main test succeeds

    # Dimensional results should be None due to invalid columns
    assert res.dimensionResults is None

    # Main test result should still be valid
    assert len(res.testResultValue) == 1
    assert res.testResultValue[0].name == "allowedValueCount"
    assert res.testResultValue[0].value == "23"  # From mock _run_results

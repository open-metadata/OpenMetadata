from typing import Any, Generator, Mapping
from unittest.mock import Mock, patch

import pandas
import pytest
from dirty_equals import HasAttributes, IsList, IsTuple
from pandas import DataFrame
from sqlalchemy import create_engine
from sqlalchemy.sql.schema import Table as SQATable
from testcontainers.postgres import PostgresContainer

from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sdk.data_quality import ColumnValueMinToBeBetween
from metadata.sdk.data_quality.dataframes.dataframe_validator import DataFrameValidator
from metadata.utils.entity_link import get_entity_link


@pytest.fixture(scope="module")
def table_fqn(db_service: DatabaseService) -> str:
    return f"{db_service.name.root}.dq_test_db.public.users"


@pytest.fixture(scope="module")
def column_unique_test(
    table_fqn: str, metadata: OpenMetadata[TestCase, CreateTestCaseRequest]
) -> TestCase:
    request = CreateTestCaseRequest(
        name="column_not_null",
        testDefinition="columnValuesToBeUnique",
        entityLink=get_entity_link(
            Table,
            table_fqn,
            column_name="username",
        ),
    )

    test_case = metadata.create_or_update(request)

    return test_case


@pytest.fixture(scope="module")
def table_row_count_test(
    table_fqn: str, metadata: OpenMetadata[TestCase, CreateTestCaseRequest]
) -> TestCase:
    request = CreateTestCaseRequest(
        name="table_row_count",
        testDefinition="tableRowCountToEqual",
        entityLink=get_entity_link(Table, table_fqn),
        parameterValues=[TestCaseParameterValue(name="value", value="5")],
    )

    test_case = metadata.create_or_update(request)

    return test_case


@pytest.fixture(scope="module")
def dataframe(
    test_data: Mapping[str, SQATable], postgres_container: PostgresContainer
) -> Generator[DataFrame, None, None]:
    engine = create_engine(
        postgres_container.get_connection_url().replace("/dvdrental", "/dq_test_db"),
        isolation_level="AUTOCOMMIT",
    )
    with engine.connect() as connection:
        yield pandas.read_sql(
            test_data["users"].select(),
            connection,
        )


def test_it_runs_tests_from_openmetadata(
    ingest_metadata: None,
    metadata: OpenMetadata[Any, Any],
    dataframe: DataFrame,
    column_unique_test: TestCase,
    table_row_count_test: TestCase,
) -> None:
    validator = DataFrameValidator(client=metadata)

    validator.add_openmetadata_test(column_unique_test.fullyQualifiedName.root)
    validator.add_openmetadata_test(table_row_count_test.fullyQualifiedName.root)

    result = validator.validate(dataframe)

    assert result == HasAttributes(
        success=True,
        total_tests=2,
        passed_tests=2,
        failed_tests=0,
    )


def test_it_runs_openmetadata_table_tests(
    table_fqn: str,
    ingest_metadata: None,
    metadata: OpenMetadata[Any, Any],
    dataframe: DataFrame,
    column_unique_test: TestCase,
    table_row_count_test: TestCase,
) -> None:
    validator = DataFrameValidator(client=metadata)

    validator.add_openmetadata_table_tests(table_fqn)

    result = validator.validate(dataframe)

    assert result == HasAttributes(
        success=True,
        total_tests=2,
        passed_tests=2,
        failed_tests=0,
    )


class TestFullUseCase:
    def test_it_runs_tests_and_publishes_results(
        self,
        table_fqn: str,
        ingest_metadata: None,
        metadata: OpenMetadata[Any, Any],
        dataframe: DataFrame,
        column_unique_test: TestCase,
        table_row_count_test: TestCase,
    ) -> None:
        # First ensure only previously reported tests exist in OM
        test_suite = metadata.get_executable_test_suite(table_fqn)
        assert test_suite is not None
        original_test_names = {t.fullyQualifiedName for t in test_suite.tests}
        assert original_test_names == {
            column_unique_test.fullyQualifiedName.root,
            table_row_count_test.fullyQualifiedName.root,
        }

        # Run validation
        validator = DataFrameValidator(client=metadata)

        validator.add_openmetadata_table_tests(table_fqn)
        # Forcing a failure with this test
        validator.add_test(
            ColumnValueMinToBeBetween(
                name="column_value_min_to_be_between_90_and_100",
                column="score",
                min_value=90,
                max_value=100,
            )
        )

        result = validator.validate(dataframe)

        assert result == HasAttributes(
            success=False,
            total_tests=3,
            passed_tests=2,
            failed_tests=1,
            test_cases_and_results=IsList(
                IsTuple(
                    HasAttributes(
                        fullyQualifiedName=HasAttributes(
                            root=column_unique_test.fullyQualifiedName.root
                        ),
                    ),
                    HasAttributes(
                        testCaseStatus=TestCaseStatus.Success,
                    ),
                ),
                IsTuple(
                    HasAttributes(
                        fullyQualifiedName=HasAttributes(
                            root=table_row_count_test.fullyQualifiedName.root
                        ),
                    ),
                    HasAttributes(
                        testCaseStatus=TestCaseStatus.Success,
                    ),
                ),
                IsTuple(
                    HasAttributes(
                        fullyQualifiedName=HasAttributes(
                            root="column_value_min_to_be_between_90_and_100"
                        ),
                    ),
                    HasAttributes(
                        testCaseStatus=TestCaseStatus.Failed,
                    ),
                ),
                check_order=False,
            ),
        )

        # Publish results
        with patch(
            "metadata.sdk.data_quality.dataframes.validation_results.get_client",
            return_value=Mock(ometa=metadata),
        ) as mock_client:
            result.publish(
                table_fqn,
            )

            mock_client.assert_called_once()

        # Validate test defined in code has been pushed to OM as well
        test_suite = metadata.get_executable_test_suite(table_fqn)

        assert test_suite is not None
        assert len(test_suite.tests) == 3
        assert original_test_names.issubset(
            {t.fullyQualifiedName for t in test_suite.tests}
        )

        assert {t.fullyQualifiedName for t in test_suite.tests} == {
            column_unique_test.fullyQualifiedName.root,
            table_row_count_test.fullyQualifiedName.root,
            f"{table_fqn}.score.column_value_min_to_be_between_90_and_100",
        }

        # Validate each test case result
        required_fields = ["testCaseResult", "testSuite", "testDefinition"]
        column_unique_result = metadata.get_by_name(
            TestCase, column_unique_test.fullyQualifiedName.root, fields=required_fields
        ).testCaseResult
        assert column_unique_result == HasAttributes(
            testCaseStatus=TestCaseStatus.Success
        )

        table_row_count_result = metadata.get_by_name(
            TestCase,
            table_row_count_test.fullyQualifiedName.root,
            fields=required_fields,
        ).testCaseResult
        assert table_row_count_result == HasAttributes(
            testCaseStatus=TestCaseStatus.Success
        )

        code_test_case_result = metadata.get_by_name(
            TestCase,
            f"{table_fqn}.score.column_value_min_to_be_between_90_and_100",
            fields=required_fields,
        ).testCaseResult
        assert code_test_case_result == HasAttributes(
            testCaseStatus=TestCaseStatus.Failed
        )

        # Clean up code test
        metadata.delete_test_case(
            f"{table_fqn}.score.column_value_min_to_be_between_90_and_100",
            recursive=True,
            hard=True,
        )

from typing import Any, Generator, Mapping

import pandas
import pytest
from dirty_equals import HasAttributes
from pandas import DataFrame
from sqlalchemy import create_engine
from sqlalchemy.sql.schema import Table as SQATable

from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sdk.data_quality.dataframes.dataframe_validator import DataFrameValidator
from metadata.utils.entity_link import get_entity_link
from tests.utils.docker_service_builders.database_container.postgres_test_container import (
    PostgresTestContainer,
)


@pytest.fixture(scope="module")
def column_unique_test(
    db_service: DatabaseService, metadata: OpenMetadata[TestCase, CreateTestCaseRequest]
) -> TestCase:
    request = CreateTestCaseRequest(
        name=f"{db_service.name.root}.dq_test_db.public.users.column_not_null",
        testDefinition="columnValuesToBeUnique",
        entityLink=get_entity_link(
            Table,
            f"{db_service.name.root}.dq_test_db.public.users",
            column_name="username",
        ),
    )

    test_case = metadata.create_or_update(request)

    return test_case


@pytest.fixture(scope="module")
def table_row_count_test(
    db_service: DatabaseService, metadata: OpenMetadata[TestCase, CreateTestCaseRequest]
) -> TestCase:
    request = CreateTestCaseRequest(
        name=f"{db_service.name.root}.dq_test_db.public.users.table_row_count",
        testDefinition="tableRowCountToEqual",
        entityLink=get_entity_link(
            Table, f"{db_service.name.root}.dq_test_db.public.users"
        ),
        parameterValues=[TestCaseParameterValue(name="value", value="5")],
    )

    test_case = metadata.create_or_update(request)

    return test_case


@pytest.fixture(scope="module")
def dataframe(
    test_data: Mapping[str, SQATable], postgres_container: PostgresTestContainer
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
    db_service: DatabaseService,
    ingest_metadata: None,
    metadata: OpenMetadata[Any, Any],
    dataframe: DataFrame,
    column_unique_test: TestCase,
    table_row_count_test: TestCase,
) -> None:
    validator = DataFrameValidator(client=metadata)

    validator.add_openmetadata_table_tests(
        f"{db_service.name.root}.dq_test_db.public.users"
    )

    result = validator.validate(dataframe)

    assert result == HasAttributes(
        success=True,
        total_tests=2,
        passed_tests=2,
        failed_tests=0,
    )

import datetime
from typing import Generator
from unittest.mock import MagicMock, Mock, patch

import pytest
from dirty_equals import Contains, DirtyEquals, HasAttributes

from metadata.data_quality.validations.models import (
    TableDiffRuntimeParameters,
    TableParameter,
)
from metadata.data_quality.validations.table.sqlalchemy.tableDiff import (
    TableDiffValidator,
)
from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.basic import Timestamp


def build_table_parameter(
    *columns: Column,
    key_columns: list[str],
    extra_columns: list[str],
    service_url: str = "postgresql://postgres:postgres@service:5432/postgres",
) -> TableParameter:
    return TableParameter.model_construct(
        serviceUrl=service_url,
        path="test_schema.test_table",
        database_service_type=DatabaseServiceType.Postgres,
        columns=columns,
        privateKey=None,
        passPhrase=None,
        key_columns=key_columns,
        extra_columns=extra_columns,
    )


@pytest.fixture
def table1_parameter() -> TableParameter:
    return build_table_parameter(
        Column.model_construct(name=ColumnName(root="id"), dataType=DataType.STRING),
        Column.model_construct(
            name=ColumnName(root="first_name"), dataType=DataType.STRING
        ),
        Column.model_construct(
            name=ColumnName(root="last_name"), dataType=DataType.STRING
        ),
        key_columns=["id"],
        extra_columns=["first_name", "last_name"],
        service_url="postgresql://postgres:postgres@service1:5432/postgres",
    )


@pytest.fixture
def table2_parameter() -> TableParameter:
    return build_table_parameter(
        Column.model_construct(
            name=ColumnName(root="table_id"), dataType=DataType.STRING
        ),
        Column.model_construct(
            name=ColumnName(root="first_name"), dataType=DataType.STRING
        ),
        Column.model_construct(
            name=ColumnName(root="last_name"), dataType=DataType.STRING
        ),
        key_columns=["table_id"],
        extra_columns=["first_name", "last_name"],
        service_url="postgresql://postgres:postgres@service2:5432/postgres",
    )


@pytest.fixture
def parameters(
    table1_parameter: TableParameter, table2_parameter: TableParameter
) -> TableDiffRuntimeParameters:
    return TableDiffRuntimeParameters(
        table1=table1_parameter,
        table2=table2_parameter,
        table_profile_config=None,
        whereClause=None,
        keyColumns=None,
        extraColumns=None,
    )


@pytest.fixture
def validator(
    parameters: TableDiffRuntimeParameters,
) -> Generator[TableDiffValidator, None, None]:
    with patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableDiff.data_diff"
    ) as data_diff:
        mock_table = MagicMock()
        mock_table.key_columns = []
        mock_table.extra_columns = []
        data_diff.connect_to_table = Mock(return_value=mock_table)

        validator = TableDiffValidator(
            runner=[],
            test_case=TestCase.model_construct(parameterValues=[]),
            execution_date=Timestamp(root=int(datetime.datetime.now().timestamp())),
        )
        validator.runtime_params = parameters
        yield validator


class TestGetColumnDiff:
    def test_it_returns_none_when_no_diff(
        self, validator: TableDiffValidator, parameters: TableDiffRuntimeParameters
    ) -> None:
        assert validator.get_column_diff() is None

    @pytest.mark.parametrize(
        "table1_parameter, table2_parameter, expected",
        (
            (
                build_table_parameter(
                    Column.model_construct(
                        name=ColumnName(root="id"), dataType=DataType.STRING
                    ),
                    Column.model_construct(
                        name=ColumnName(root="last_name"), dataType=DataType.STRING
                    ),
                    key_columns=["id"],
                    extra_columns=["last_name"],
                ),
                build_table_parameter(
                    Column.model_construct(
                        name=ColumnName(root="id"), dataType=DataType.STRING
                    ),
                    Column.model_construct(
                        name=ColumnName(root="first_name"), dataType=DataType.STRING
                    ),
                    key_columns=["id"],
                    extra_columns=["first_name"],
                ),
                HasAttributes(
                    testCaseStatus=TestCaseStatus.Failed,
                    result=Contains("Removed columns: last_name")
                    & Contains("Added columns: first_name")
                    & ~Contains("Changed"),
                ),
            ),
            (
                build_table_parameter(
                    Column.model_construct(
                        name=ColumnName(root="id"), dataType=DataType.STRING
                    ),
                    Column.model_construct(
                        name=ColumnName(root="last_name"), dataType=DataType.STRING
                    ),
                    key_columns=["id"],
                    extra_columns=["last_name"],
                ),
                build_table_parameter(
                    Column.model_construct(
                        name=ColumnName(root="table_id"), dataType=DataType.STRING
                    ),
                    Column.model_construct(
                        name=ColumnName(root="first_name"), dataType=DataType.STRING
                    ),
                    key_columns=["table_id"],
                    extra_columns=["first_name"],
                ),
                HasAttributes(
                    testCaseStatus=TestCaseStatus.Failed,
                    result=Contains("Removed columns: last_name")
                    & Contains("Added columns: first_name")
                    & ~Contains("Changed"),
                ),
            ),
            (
                build_table_parameter(
                    Column.model_construct(
                        name=ColumnName(root="id"), dataType=DataType.STRING
                    ),
                    Column.model_construct(
                        name=ColumnName(root="last_name"), dataType=DataType.STRING
                    ),
                    key_columns=["id"],
                    extra_columns=["last_name"],
                ),
                build_table_parameter(
                    Column.model_construct(
                        name=ColumnName(root="table_id"), dataType=DataType.STRING
                    ),
                    Column.model_construct(
                        name=ColumnName(root="first_name"), dataType=DataType.STRING
                    ),
                    key_columns=["id"],  # The error trying to solve in #22302
                    extra_columns=["first_name"],
                ),
                HasAttributes(
                    testCaseStatus=TestCaseStatus.Failed,
                    result=Contains("Removed columns: last_name")
                    & Contains("Added columns: table_id, first_name")
                    & ~Contains("Changed"),
                ),
            ),
        ),
    )
    def test_it_returns_the_expected_result(
        self,
        validator: TableDiffValidator,
        parameters: TableDiffRuntimeParameters,
        expected: DirtyEquals,
    ) -> None:
        assert validator.get_column_diff() == expected

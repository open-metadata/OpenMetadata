from unittest.mock import Mock
from uuid import uuid4

import pytest
from sqlalchemy import Column as SAColumn
from sqlalchemy import MetaData, String, create_engine
from sqlalchemy.orm import declarative_base

from metadata.data_quality.validations.runtime_param_setter.table_diff_params_setter import (
    TableDiffParamsSetter,
)
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    PartitionIntervalTypes,
    PartitionProfilerConfig,
    Table,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.basic import EntityLink
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.profiler.processor.sampler.sqlalchemy.sampler import SQASampler

MOCK_TABLE = Table(
    id=uuid4(),
    name="user",
    databaseSchema=EntityReference(id=uuid4(), type="databaseSchema", name="name"),
    columns=[
        Column(
            name=ColumnName("id"),
            dataType=DataType.INT,
        ),
    ],
)


@pytest.mark.parametrize(
    "input,expected",
    [
        (
            "postgresql+psycopg2://test:test@localhost:5432/dvdrental",
            "postgresql://test:test@localhost:5432/database",
        ),
        (
            "snowflake://test:test@localhost:5432/dvdrental",
            "snowflake://test:test@localhost:5432/database/schema",
        ),
    ],
)
def test_get_data_diff_url(input, expected):
    assert expected == TableDiffParamsSetter(
        None, None, MOCK_TABLE, None
    ).get_data_diff_url(input, "service.database.schema.table")


@pytest.mark.parametrize(
    "input,expected",
    [
        (
            PartitionProfilerConfig(
                enablePartitioning=False,
            ),
            "",
        ),
        (
            PartitionProfilerConfig(
                enablePartitioning=True,
                partitionIntervalType=PartitionIntervalTypes.COLUMN_VALUE,
                partitionColumnName="my_column",
                partitionValues=["foo", "bar"],
            ),
            "(my_column IN ('foo', 'bar'))",
        ),
    ],
)
def test_partitioned_where_clause(input, expected):
    engine = create_engine("sqlite://")
    session = create_and_bind_session(engine)
    metadata_obj = MetaData()
    Base = declarative_base(metadata=metadata_obj)

    class MyTable(Base):
        __tablename__ = "customer"
        id = SAColumn(String(30), primary_key=True)
        my_column = SAColumn(String(30))

    metadata_obj.create_all(engine)
    mock_sampler = SQASampler(session, MyTable, Mock())
    mock_sampler._partition_details = input
    setter = TableDiffParamsSetter(None, None, MOCK_TABLE, mock_sampler)
    test_case = TestCase(
        name="test",
        testDefinition=EntityReference(id=uuid4(), type="testDefinition"),
        testSuite=EntityReference(id=uuid4(), type="testSuite"),
        entityLink=EntityLink(
            root="<#E::table::POSTGRES_SERVICE.dvdrental.public.customer>"
        ),
        parameterValues=[
            TestCaseParameterValue(
                name="run",
                value="y",
            )
        ],
    )
    assert setter.build_where_clause(test_case) == expected

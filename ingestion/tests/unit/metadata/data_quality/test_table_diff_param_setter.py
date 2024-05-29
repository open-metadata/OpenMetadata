from unittest.mock import Mock
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, MetaData, String, Column
from sqlalchemy.orm import declarative_base

from metadata.data_quality.validations.runtime_param_setter.table_diff_params_setter import (
    TableDiffParamsSetter,
)
from metadata.generated.schema.entity.data.table import (
    PartitionProfilerConfig,
    PartitionIntervalTypes,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.basic import EntityLink
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.profiler.processor.sampler.sqlalchemy.sampler import SQASampler


@pytest.mark.parametrize(
    "input,expected",
    [
        (
            "postgresql+psycopg2://test:test@localhost:5432/dvdrental",
            "postgresql://test:test@localhost:5432/dvdrental",
        )
    ],
)
def test_get_data_diff_url(input, expected):
    assert (
        TableDiffParamsSetter(None, None, None, None).get_data_diff_url(
            input, "service.database.schema.table"
        )
        == expected
    )


@pytest.mark.parametrize(
    "input,expected",
    [
        (
            PartitionProfilerConfig(
                enablePartitioning=False,
            ),
            None,
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
        id = Column(String(30), primary_key=True)
        my_column = Column(String(30))

    metadata_obj.create_all(engine)
    mock_sampler = SQASampler(session, MyTable, Mock())
    mock_sampler._partition_details = input
    setter = TableDiffParamsSetter(None, None, None, mock_sampler)
    test_case = TestCase(
        name="test",
        testDefinition=EntityReference(id=uuid4(), type="testDefinition"),
        testSuite=EntityReference(id=uuid4(), type="testSuite"),
        entityLink=EntityLink(
            __root__="<#E::table::POSTGRES_SERVICE.dvdrental.public.customer>"
        ),
        parameterValues=[
            TestCaseParameterValue(
                name="run",
                value="y",
            )
        ],
    )
    assert setter.build_where_clause(test_case) == expected

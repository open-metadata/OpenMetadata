from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy import Column as SAColumn
from sqlalchemy import MetaData, String, create_engine
from sqlalchemy.orm import declarative_base

from metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter import (
    BaseTableParameter,
)
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
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.basic import EntityLink
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.sampler.sqlalchemy.sampler import SQASampler

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
SERVICE_CONNECTION_CONFIG = MysqlConnection(
    username="test",
    authType=BasicAuth(
        password="test",
    ),
    hostPort="localhost:5432",
    databaseSchema="mysql_db",
)


@pytest.mark.parametrize(
    "input,expected",
    [
        (
            DatabaseService(
                id="85811038-099a-11ed-861d-0242ac120002",
                name="postgres",
                connection=DatabaseConnection(
                    config=PostgresConnection(
                        username="test",
                        authType=BasicAuth(
                            password="test",
                        ),
                        hostPort="localhost:5432",
                        database="dvdrental",
                    )
                ),
                serviceType=DatabaseServiceType.Postgres,
            ),
            "postgresql://test:test@localhost:5432/database",
        ),
        (
            DatabaseService(
                id="85811038-099a-11ed-861d-0242ac120002",
                name="mysql",
                connection=DatabaseConnection(config=SERVICE_CONNECTION_CONFIG),
                serviceType=DatabaseServiceType.Mysql,
            ),
            "mysql://test:test@localhost:5432/mysql_db",
        ),
        (
            DatabaseService(
                id="85811038-099a-11ed-861d-0242ac120002",
                name="snowflake",
                connection=DatabaseConnection(
                    config=SnowflakeConnection(
                        username="test",
                        password="test",
                        account="sf-account",
                        database="dvdrental",
                        warehouse="SF_DH",
                    )
                ),
                serviceType=DatabaseServiceType.Postgres,
            ),
            "snowflake://test:test@sf-account/database/schema?account=sf-account&warehouse=SF_DH",
        ),
    ],
)
def test_get_data_diff_url(input, expected):
    assert expected == BaseTableParameter.get_data_diff_url(
        input, "service.database.schema.table"
    )


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

    with patch.object(SQASampler, "get_client", return_value=session), patch.object(
        SQASampler, "build_table_orm", return_value=MyTable
    ):
        mock_sampler = SQASampler(
            service_connection_config=SERVICE_CONNECTION_CONFIG,
            ometa_client=Mock(),
            entity=Mock(),
        )
        mock_sampler.partition_details = input
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

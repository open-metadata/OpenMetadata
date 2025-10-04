import json
import uuid
from typing import List
from unittest.mock import create_autospec

import pytest
from dirty_equals import HasAttributes, IsInstance, IsListOrTuple

from metadata.data_quality.validations.models import (
    TableDiffRuntimeParameters,
    TableParameter,
)
from metadata.data_quality.validations.runtime_param_setter.table_diff_params_setter import (
    TableDiffParamsSetter,
    TableParameterSetter,
)
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    Table,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sampler.sampler_interface import SamplerInterface


@pytest.fixture
def metadata(
    service1: DatabaseService, table1: Table, service2: DatabaseService, table2: Table
) -> OpenMetadata:
    mock = create_autospec(OpenMetadata, spec_set=True, instance=True)

    objects_by_entity_and_id = {
        (DatabaseService, table1.service.id): service1,
        (DatabaseService, table2.service.id): service2,
    }

    objects_by_entity_and_name = {
        (Table, table2.fullyQualifiedName.root): table2,
    }

    def mock_get_by_id(entity, entity_id, **kwargs):
        return objects_by_entity_and_id.get((entity, entity_id), None)

    def mock_get_by_name(entity, fqn, **kwargs):
        return objects_by_entity_and_name.get((entity, fqn), None)

    mock.get_by_id.side_effect = mock_get_by_id
    mock.get_by_name.side_effect = mock_get_by_name

    return mock


@pytest.fixture
def service_connection_config() -> DatabaseConnection:
    return create_autospec(DatabaseConnection, spec_set=True, instance=True)


@pytest.fixture
def sampler() -> SamplerInterface:
    mock = create_autospec(SamplerInterface, instance=True)
    mock.partition_details = None
    return mock


@pytest.fixture
def service1() -> DatabaseService:
    return DatabaseService.model_construct(
        id=uuid.uuid4(),
        name="TestService1",
        fullyQualifiedName="TestService1",
        serviceType=DatabaseServiceType.Postgres,
        connection=DatabaseConnection(config=PostgresConnection.model_construct()),
    )


@pytest.fixture
def service2() -> DatabaseService:
    return DatabaseService.model_construct(
        id=uuid.uuid4(),
        name="TestService2",
        fullyQualifiedName="TestService2",
        serviceType=DatabaseServiceType.Postgres,
        connection=DatabaseConnection(config=PostgresConnection.model_construct()),
    )


@pytest.fixture
def table1() -> Table:
    return Table.model_construct(
        id=uuid.uuid4(),
        name="table1",
        fullyQualifiedName=FullyQualifiedEntityName(
            root="TestService1.test_db.test_schema.table1"
        ),
        service=EntityReference.model_construct(id=uuid.uuid4(), name="test_service1"),
        columns=[
            Column.model_construct(
                name=ColumnName(root="id"),
                dataType=DataType.STRING,
            ),
            Column.model_construct(
                name=ColumnName(root="name"),
                dataType=DataType.STRING,
            ),
        ],
    )


@pytest.fixture
def table2() -> Table:
    return Table.model_construct(
        id=uuid.uuid4(),
        name="table2",
        fullyQualifiedName=FullyQualifiedEntityName(
            root="TestService2.test_db.test_schema.table2"
        ),
        service=EntityReference.model_construct(id=uuid.uuid4(), name="test_service2"),
        columns=[
            Column.model_construct(
                name=ColumnName(root="table_id"),
                dataType=DataType.STRING,
            ),
            Column.model_construct(
                name=ColumnName(root="name"),
                dataType=DataType.STRING,
            ),
        ],
    )


def fake_get_service_url(
    param_setter: TableParameterSetter, service: DatabaseService
) -> str:
    return "postgresql+psycopg2://test:test@localhost/test"


@pytest.fixture
def setter(
    metadata: OpenMetadata,
    service_connection_config: DatabaseConnection,
    sampler: SamplerInterface,
    table1: Table,
) -> TableDiffParamsSetter:
    return TableDiffParamsSetter(
        ometa_client=metadata,
        service_connection_config=service_connection_config,
        sampler=sampler,
        table_entity=table1,
        service_url_getter=fake_get_service_url,
    )


@pytest.fixture
def parameter_values() -> List[TestCaseParameterValue]:
    return [
        TestCaseParameterValue(
            name="table2", value="TestService2.test_db.test_schema.table2"
        )
    ]


def test_setter_gets_default_key_columns(
    setter: TableDiffParamsSetter, parameter_values: List[TestCaseParameterValue]
) -> None:
    test_case = TestCase.model_construct(
        parameterValues=[
            *parameter_values,
            TestCaseParameterValue(name="keyColumns", value=json.dumps(["id"])),
        ],
    )

    assert setter.get_parameters(test_case) == IsInstance(
        TableDiffRuntimeParameters
    ) & HasAttributes(
        keyColumns=["id"],
        extraColumns=IsListOrTuple("name", "table_id", check_order=False),
        table1=IsInstance(TableParameter)
        & HasAttributes(
            key_columns=["id"],
        ),
        table2=IsInstance(TableParameter)
        & HasAttributes(
            key_columns=["id"],
        ),
    )


def test_setter_gets_per_table_key_columns(
    setter: TableDiffParamsSetter, parameter_values: List[TestCaseParameterValue]
) -> None:
    test_case = TestCase.model_construct(
        parameterValues=[
            *parameter_values,
            TestCaseParameterValue(name="keyColumns", value=json.dumps(["id"])),
            TestCaseParameterValue(
                name="table2.keyColumns", value=json.dumps(["table_id"])
            ),
        ]
    )

    assert setter.get_parameters(test_case) == IsInstance(
        TableDiffRuntimeParameters
    ) & HasAttributes(
        keyColumns=["id"],
        extraColumns=IsListOrTuple("name", check_order=False),
        table1=IsInstance(TableParameter)
        & HasAttributes(
            key_columns=["id"],
        ),
        table2=IsInstance(TableParameter)
        & HasAttributes(
            key_columns=["table_id"],
        ),
    )

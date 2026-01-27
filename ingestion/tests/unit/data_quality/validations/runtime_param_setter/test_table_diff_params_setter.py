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
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
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
def service_connection_config() -> PostgresConnection:
    return PostgresConnection.model_construct()


@pytest.fixture
def sampler() -> SamplerInterface:
    mock = create_autospec(SamplerInterface, instance=True)
    mock.partition_details = None
    return mock


@pytest.fixture
def service1(service_connection_config: PostgresConnection) -> DatabaseService:
    return DatabaseService.model_construct(
        id=uuid.uuid4(),
        name="TestService1",
        fullyQualifiedName="TestService1",
        serviceType=DatabaseServiceType.Postgres,
        connection=DatabaseConnection(config=service_connection_config),
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


class TestForSnowflake:
    @pytest.fixture
    def service_connection_config(self) -> SnowflakeConnection:
        return SnowflakeConnection(
            account="account",
            username="username",
            warehouse="warehouse",
            privateKey="-----BEGIN ENCRYPTED PRIVATE KEY-----\\nMIIFNTBfBgkqhkiG9w0BBQ0wUjAxBgkqhkiG9w0BBQwwJAQQkygnWhWG1aAiElog\\n0itnbwICCAAwDAYIKoZIhvcNAgkFADAdBglghkgBZQMEASoEEHwOOuGPCXoQiqPd\\ntg/fkPAEggTQqUObUeUhiBSJNVZ2hF5O/oK2glaT7gAsXG6FB56GD09KjdNE+KTk\\nuEMmQgKN1oYdlY6NVJ7zDak6a/fn79jWHN0jTEODJKoo+2sD4QvJxFqqxp008mYS\\n9HTJhlwmfM4cqCLaIbAvDG74s8+48Hq5n71gA91RdPHxtE/La91hOCS+UVRjAuXZ\\nJ2bEYuoWrP6FSTysIDNFhI3SshzrP+SJ7rGY1ahkhHu5kfActy1ATr9288vWKiHv\\n564GOq85Vt8QGcq6dM3vClKEAhljS35TMs2LlM3cP+sFCO4PYRaOtrH7ENuusaOU\\nvfEpo41W53uVP6hGMU8LuWzdDjVZUqNJdcnlAIdUkI8XG70IlMyGAna7Y5UyB5Xn\\nXlivhvvJSHly9pj00QWI5uiSY08cDDqvLmyg5Vmqr2lINfn5kMjtoeVF4T9UoxXc\\nLrCLQmYqhUYtBBJh7i1IxepqI69KaotgZsDwV5oJz2+GofVo/O0kXq3/JWvlpQ8o\\nkisZiWSpld/NFeJdxCuE308zdLb5D5aeJbcyHM0ldZ2+zH6+ERCs134bkEJFeBmC\\nmNJ++DPfZJGe6AWqM9qrBr2UZyZhLg5VV2MzDB3YBkI+FxSVnRZNu9WWreLw9+k5\\n6LJ4Mnwrw+jGdPBXf5sqEoCmem85N1IKtJMXl5BNHE8V2MZm+xPLRypoFH2ipNEL\\nBu8XFaqxe+4cTA/eYoyf0DEzGYY/x1PMy5y3EYJu7xhkkCjzX09ZKkM3EdycCEvY\\nAdIKhXdKphe88WBzDtssjBtEJGjgZkX5JioW0VrMOlQBXA3xS/vdRemBXwTM2Fmy\\nuZajbWQq1yBtlpKtRFF9Yj2QJinumjoiRCWIcNcEN6/V+5IETClzBOYgwpZHwSIv\\nZGbIXPHrmbk2GIJXtRXjnXGVIrcgUOJfrZmpvpBhpcbAIoRUwCj7iSgBMOhKth8Y\\nk3uc8ZTXDdKAayxo1USG87tWojeyu0rRJxCiu4WuAQgHnUYRpViOrPGO7msKPPhd\\nZLO+x428W2myXHw/ZsLZoM2AyK4h6M0m647L9+lbrurGkTHwDs35RuNeflyTvGkF\\nOfTN9xYgeBXi99TdLmo0G1giKqKp6Gq1h+iTXbqbqJiqS1wzS5duvLA53uojkHIC\\n2/fCnANUhMKtGUCyHZ8Lr6FLYQiBDmCQwq1buEKHLgA7uap6WNVLnSAvRmPWGwn3\\nmZxuVBBX2uDBkZgBbVE19kSAWjFjfAGr6+LCZpHHcUWP+LiV/Qpbbrg2j3xcI7d8\\ncwjON0uR7DU10i3gWncsPUCACs44O86OHVJTFUqrZAMjnSdXuSmiIHzTaOY0QhYn\\n/K35NknBplnD3bw89by0vfFbGsvm19jTawzLVhmGBLnQAB780vODdKjMKgUfzW9t\\nsDO2+gdo7vO5Ep6xh+UVzakAY+JD6Z0qDnM8KNURo9iku06Ctroyf7drHq5rqb3A\\nSLsYtMImlPbHLGX62lNqs9016h6QoDCazxW1Ef/B5/gnLfCeiW4rTMemZ6Nlzu+8\\ntDMxQrRpo5tGdhZgfiEIfFUlZTMJWmjHzZw5z4LYvxCKBPabUSxPSeuTi8ll2ljF\\n8fGq0P3vYJbQ0SIw20Srmqdoj1g3HJP4D+a0iUlMpr7wdkP3sAgy7so=\\n-----END ENCRYPTED PRIVATE KEY-----",
            snowflakePrivatekeyPassphrase="passphrase",
        )

    @pytest.fixture
    def service1(
        self, service_connection_config: SnowflakeConnection
    ) -> DatabaseService:
        return DatabaseService.model_construct(
            id=uuid.uuid4(),
            name="TestService1",
            fullyQualifiedName="TestService1",
            serviceType=DatabaseServiceType.Snowflake,
            connection=DatabaseConnection(config=service_connection_config),
        )

    @pytest.fixture
    def service2(
        self, service_connection_config: SnowflakeConnection
    ) -> DatabaseService:
        return DatabaseService.model_construct(
            id=uuid.uuid4(),
            name="TestService2",
            fullyQualifiedName="TestService2",
            serviceType=DatabaseServiceType.Snowflake,
            connection=DatabaseConnection(config=service_connection_config),
        )

    @pytest.fixture
    def setter(
        self,
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
        )

    def test_setter_gets_parameters_for_snowflake(
        self,
        setter: TableDiffParamsSetter,
        parameter_values: List[TestCaseParameterValue],
    ) -> None:
        test_case = TestCase.model_construct(
            parameterValues=[
                *parameter_values,
                TestCaseParameterValue(name="keyColumns", value=json.dumps(["id"])),
                TestCaseParameterValue(
                    name="table2.keyColumns", value=json.dumps(["table_id"])
                ),
            ],
        )

        assert setter.get_parameters(test_case) == IsInstance(
            TableDiffRuntimeParameters
        )

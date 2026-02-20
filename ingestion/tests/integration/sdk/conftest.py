"""
Minimal conftest for SDK integration tests.
Override the parent conftest to avoid testcontainers dependency.
"""
import uuid

import pytest
from sqlalchemy import Column as SQAColumn
from sqlalchemy import Integer, MetaData, String
from sqlalchemy import Table as SQATable
from sqlalchemy import create_engine

from _openmetadata_testutils.ometa import int_admin_ometa
from _openmetadata_testutils.postgres.conftest import postgres_container
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="module")
def metadata():
    return int_admin_ometa()


@pytest.fixture(scope="module")
def create_postgres_service(postgres_container):
    return CreateDatabaseServiceRequest(
        name=f"dq_test_service_{uuid.uuid4().hex[:8]}",
        serviceType=DatabaseServiceType.Postgres,
        connection=DatabaseConnection(
            config=PostgresConnection(
                username=postgres_container.username,
                authType=BasicAuth(password=postgres_container.password),
                hostPort="localhost:"
                + str(postgres_container.get_exposed_port(postgres_container.port)),
                database="dq_test_db",
            )
        ),
    )


@pytest.fixture(scope="module")
def db_service(metadata, create_postgres_service, postgres_container):
    engine = create_engine(
        postgres_container.get_connection_url(), isolation_level="AUTOCOMMIT"
    )
    engine.execute("CREATE DATABASE dq_test_db")

    service_entity = metadata.create_or_update(data=create_postgres_service)
    service_entity.connection.config.authType.password = (
        create_postgres_service.connection.config.authType.password
    )
    yield service_entity

    service = metadata.get_by_name(
        DatabaseService, service_entity.fullyQualifiedName.root
    )
    if service:
        metadata.delete(DatabaseService, service.id, recursive=True, hard_delete=True)


@pytest.fixture(scope="module")
def database(metadata, db_service):
    database_entity = metadata.create_or_update(
        CreateDatabaseRequest(
            name="dq_test_db",
            service=db_service.fullyQualifiedName,
        )
    )
    return database_entity


@pytest.fixture(scope="module")
def schema(metadata, database):
    schema_entity = metadata.create_or_update(
        CreateDatabaseSchemaRequest(
            name="public",
            database=database.fullyQualifiedName,
        )
    )
    return schema_entity


@pytest.fixture(scope="module")
def test_data(db_service, postgres_container):
    engine = create_engine(
        postgres_container.get_connection_url().replace("/dvdrental", "/dq_test_db")
    )

    sql_metadata = MetaData()

    users_table = SQATable(
        "users",
        sql_metadata,
        SQAColumn("id", Integer, primary_key=True),
        SQAColumn("username", String(50), nullable=False),
        SQAColumn("email", String(100)),
        SQAColumn("age", Integer),
        SQAColumn("score", Integer),
    )

    products_table = SQATable(
        "products",
        sql_metadata,
        SQAColumn("product_id", Integer, primary_key=True),
        SQAColumn("name", String(100)),
        SQAColumn("price", Integer),
    )

    stg_products_table = SQATable(
        "stg_products",
        sql_metadata,
        SQAColumn("id", Integer, primary_key=True),
        SQAColumn("name", String(100)),
        SQAColumn("price", Integer),
    )

    sql_metadata.create_all(engine)

    with engine.connect() as conn:
        conn.execute(
            users_table.insert(),
            [
                {
                    "id": 1,
                    "username": "alice",
                    "email": "alice@example.com",
                    "age": 25,
                    "score": 85,
                },
                {
                    "id": 2,
                    "username": "bob",
                    "email": "bob@example.com",
                    "age": 30,
                    "score": 90,
                },
                {"id": 3, "username": "charlie", "email": None, "age": 35, "score": 75},
                {
                    "id": 4,
                    "username": "diana",
                    "email": "diana@example.com",
                    "age": 28,
                    "score": 95,
                },
                {
                    "id": 5,
                    "username": "eve",
                    "email": "eve@example.com",
                    "age": 22,
                    "score": 88,
                },
            ],
        )

        conn.execute(
            products_table.insert(),
            [
                {"product_id": 1, "name": "Widget", "price": 100},
                {"product_id": 2, "name": "Gadget", "price": 200},
                {"product_id": 3, "name": "Doohickey", "price": 150},
            ],
        )

        conn.execute(
            stg_products_table.insert(),
            [
                {"id": 1, "name": "Widget", "price": 100},
                {"id": 2, "name": "Gadget", "price": 200},
                {"id": 3, "name": "Doohickey", "price": 150},
            ],
        )

    return {
        "users": users_table,
        "products": products_table,
        "stg_products": stg_products_table,
    }


@pytest.fixture(scope="module")
def ingest_metadata(metadata, db_service, schema, test_data):
    workflow_config = {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": "DatabaseMetadata",
                    "schemaFilterPattern": {"includes": ["public"]},
                }
            },
            "serviceConnection": db_service.connection.model_dump(),
        },
        "sink": {"type": "metadata-rest", "config": {}},
        "workflowConfig": {
            "loggerLevel": "INFO",
            "openMetadataServerConfig": metadata.config.model_dump(),
        },
    }

    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()

    return workflow


@pytest.fixture(scope="module")
def patch_passwords(db_service, monkeymodule):
    def override_password(getter):
        def inner(*args, **kwargs):
            result = getter(*args, **kwargs)
            if isinstance(result, DatabaseService):
                if result.fullyQualifiedName.root == db_service.fullyQualifiedName.root:
                    result.connection.config.authType.password = (
                        db_service.connection.config.authType.password
                    )
            return result

        return inner

    monkeymodule.setattr(
        "metadata.ingestion.ometa.ometa_api.OpenMetadata.get_by_name",
        override_password(OpenMetadata.get_by_name),
    )

    monkeymodule.setattr(
        "metadata.ingestion.ometa.ometa_api.OpenMetadata.get_by_id",
        override_password(OpenMetadata.get_by_id),
    )


@pytest.fixture(scope="module")
def monkeymodule():
    with pytest.MonkeyPatch.context() as mp:
        yield mp

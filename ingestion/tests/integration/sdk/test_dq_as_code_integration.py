"""
Integration tests for DQ as Code SDK with a running OpenMetadata server.
Tests that data quality validators are actually executed against real PostgreSQL data.
"""
import sys

import pytest
from dirty_equals import HasAttributes
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
from metadata.generated.schema.entity.data.table import Table
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
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.basic import EntityLink
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sdk.data_quality import (
    ColumnValuesToBeBetween,
    ColumnValuesToBeNotNull,
    ColumnValuesToBeUnique,
    TableColumnCountToBeBetween,
    TableDiff,
    TableRowCountToBeBetween,
    TestRunner,
)
from metadata.workflow.metadata import MetadataWorkflow

if not sys.version_info >= (3, 9):
    pytest.skip(
        "requires python 3.9+ due to incompatibility with testcontainers",
        allow_module_level=True,
    )


@pytest.fixture(scope="module")
def metadata():
    return int_admin_ometa()


@pytest.fixture(scope="module")
def create_postgres_service(postgres_container, tmp_path_factory):
    return CreateDatabaseServiceRequest(
        name="dq_test_service_" + tmp_path_factory.mktemp("dq").name,
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
def test_data(postgres_container):
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


def test_table_row_count_tests(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
):
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.users"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    runner.add_test(
        TableRowCountToBeBetween(min_count=1, max_count=10).with_description(
            "Check users table has between 1-10 rows"
        )
    )

    results = runner.run()

    assert len(results) == 1
    result = results[0]
    assert result.testCaseResult.testCaseStatus == TestCaseStatus.Success

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )


def test_table_row_count_failure(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
):
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.users"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    runner.add_test(
        TableRowCountToBeBetween(min_count=100, max_count=1000).with_description(
            "Test that fails - expects 100-1000 rows but has 5"
        )
    )

    results = runner.run()

    assert len(results) == 1
    result = results[0]
    assert result.testCaseResult.testCaseStatus == TestCaseStatus.Failed

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )


def test_table_column_count_test(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
):
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.products"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    runner.add_test(
        TableColumnCountToBeBetween(min_count=2, max_count=5).with_description(
            "Check products table has 2-5 columns"
        )
    )

    results = runner.run()

    assert len(results) == 1
    result = results[0]
    assert result.testCaseResult.testCaseStatus == TestCaseStatus.Success

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )


def test_column_unique_test(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
):
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.users"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    runner.add_test(
        ColumnValuesToBeUnique(column="id")
        .with_description("Check user IDs are unique")
        .with_compute_row_count(True)
    )

    results = runner.run()

    assert len(results) == 1
    result = results[0]
    assert result.testCaseResult.testCaseStatus == TestCaseStatus.Success
    assert result.testCaseResult.passedRows == 5
    assert result.testCaseResult.failedRows == 0

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )


def test_column_not_null_test(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
):
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.users"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    test = (
        ColumnValuesToBeNotNull(column="email")
        .with_description("Check email is not null")
        .with_compute_row_count(True)
    )

    runner.add_test(test)

    results = runner.run()

    # Because of parallel tests, the table might contain a TestSuite with other tests already
    test_result = next(
        r
        for r in results
        if r.testCase.testDefinition.name == test.test_definition_name
    )

    assert test_result.testCaseResult.testCaseStatus == TestCaseStatus.Failed
    assert test_result.testCaseResult.passedRows == 4
    assert test_result.testCaseResult.failedRows == 1

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )


def test_column_values_between_test(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
):
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.users"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    test = (
        ColumnValuesToBeBetween(column="age", min_value=20, max_value=40)
        .with_description("Check age is between 20-40")
        .with_compute_row_count(True)
    )

    runner.add_test(test)

    results = runner.run()

    # Because of parallel tests, the table might contain a TestSuite with other tests already
    test_result = next(
        r
        for r in results
        if r.testCase.testDefinition.name == test.test_definition_name
    )

    assert test_result.testCaseResult.testCaseStatus == TestCaseStatus.Success
    assert test_result.testCaseResult.passedRows == 5
    assert test_result.testCaseResult.failedRows == 0

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )


def test_multiple_tests_in_single_runner(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
):
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.users"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    tests = (
        TableRowCountToBeBetween(min_count=1, max_count=10),
        TableColumnCountToBeBetween(min_count=3),
        ColumnValuesToBeUnique(column="username"),
        ColumnValuesToBeNotNull(column="username"),
    )

    runner.add_tests(*tests)

    results = runner.run()

    table_row_count_result = next(
        r
        for r in results
        if r.testCase
        == HasAttributes(
            testDefinition=HasAttributes(name=tests[0].test_definition_name),
            parameterValues=[
                HasAttributes(name="minValue", value="1"),
                HasAttributes(name="maxValue", value="10"),
            ],
        )
    )
    assert (
        table_row_count_result.testCaseResult.testCaseStatus == TestCaseStatus.Success
    )

    test_table_column_count_result = next(
        r
        for r in results
        if r.testCase
        == HasAttributes(
            testDefinition=HasAttributes(name=tests[1].test_definition_name),
            parameterValues=[
                HasAttributes(name="minColValue", value="3"),
            ],
        )
    )
    assert (
        test_table_column_count_result.testCaseResult.testCaseStatus
        == TestCaseStatus.Success
    )

    column_values_unique_result = next(
        r
        for r in results
        if r.testCase
        == HasAttributes(
            testDefinition=HasAttributes(name=tests[2].test_definition_name),
            entityLink=EntityLink(
                root="<#E::table::dq_test_service_dq0.dq_test_db.public.users::columns::username>"
            ),
        )
    )
    assert (
        column_values_unique_result.testCaseResult.testCaseStatus
        == TestCaseStatus.Success
    )

    column_values_not_null_result = next(
        r
        for r in results
        if r.testCase
        == HasAttributes(
            testDefinition=HasAttributes(name=tests[3].test_definition_name),
            entityLink=EntityLink(
                root="<#E::table::dq_test_service_dq0.dq_test_db.public.users::columns::username>"
            ),
        )
    )
    assert (
        column_values_not_null_result.testCaseResult.testCaseStatus
        == TestCaseStatus.Success
    )

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )


def test_runner_for_table_class_method(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
):
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.products"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    runner.add_test(TableRowCountToBeBetween(min_count=1, max_count=10))

    results = runner.run()

    assert len(results) == 1
    assert results[0].testCaseResult.testCaseStatus == TestCaseStatus.Success

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )


def test_runner_for_table_diff_test(
    metadata,
    db_service,
    ingest_metadata,
    patch_passwords,
) -> None:
    table_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.products"
    table2_fqn = f"{db_service.fullyQualifiedName.root}.dq_test_db.public.stg_products"

    runner = TestRunner.for_table(table_fqn, client=metadata)

    runner.add_test(
        TableDiff(
            table2=table2_fqn,
            key_columns=["product_id"],
            table2_key_columns=["id"],
        )
    )

    results = runner.run()

    assert len(results) == 1
    assert results[0].testCaseResult.testCaseStatus == TestCaseStatus.Success

    table = metadata.get_by_name(Table, table_fqn)
    if table:
        for test_case in metadata.list_entities(
            entity=TestCase,
            fields=["testSuite", "testDefinition"],
            params={"entityLink": f"<#E::table::{table_fqn}>"},
        ).entities:
            metadata.delete(
                entity=type(test_case),
                entity_id=test_case.id,
                hard_delete=True,
                recursive=True,
            )

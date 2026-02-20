from datetime import datetime

import pytest
from dirty_equals import IsApprox, IsPositiveInt
from pydantic import BaseModel
from sqlalchemy import VARBINARY
from sqlalchemy import Column as SQAColumn
from sqlalchemy import MetaData
from sqlalchemy import Table as SQATable
from sqlalchemy import create_engine
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine import Connection, make_url
from sqlalchemy.sql import sqltypes

from _openmetadata_testutils.postgres.conftest import postgres_container
from _openmetadata_testutils.pydantic.test_utils import assert_equal_pydantic_objects
from metadata.data_quality.api.models import TestCaseDefinition
from metadata.generated.schema.entity.data.table import (
    ProfileSampleType,
    Table,
    TableProfilerConfig,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuiteConfigType,
)
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.data_quality import TestSuiteWorkflow


class TestParameters(BaseModel):
    test_case_defintion: TestCaseDefinition
    table2_fqn: str
    expected: TestCaseResult
    table_profile_config: TableProfilerConfig = None

    def __init__(self, *args, **kwargs):
        if args:
            # Map positional arguments to fields
            field_names = list(self.__annotations__.keys())
            kwargs.update(dict(zip(field_names, args)))

        super().__init__(**kwargs)


@pytest.mark.parametrize(
    "parameters",
    [
        pytest.param(TestParameters(*t), id=t[0].name)
        for t in [
            (
                TestCaseDefinition(
                    name="compare_same_tables",
                    testDefinitionName="tableDiff",
                    computePassedFailedRowCount=True,
                    parameterValues=[
                        TestCaseParameterValue(
                            name="keyColumns", value="['customer_id']"
                        ),
                    ],
                ),
                "POSTGRES_SERVICE.dvdrental.public.customer",
                TestCaseResult(
                    timestamp=int(datetime.now().timestamp() * 1000),
                    testCaseStatus=TestCaseStatus.Success,
                    failedRows=0,
                    passedRows=599,
                ),
            ),
            (
                TestCaseDefinition(
                    name="compare_same_tables_with_percentage_sample",
                    testDefinitionName="tableDiff",
                    computePassedFailedRowCount=True,
                    parameterValues=[
                        TestCaseParameterValue(
                            name="keyColumns", value="['customer_id']"
                        ),
                    ],
                ),
                "POSTGRES_SERVICE.dvdrental.public.customer",
                TestCaseResult.model_construct(
                    timestamp=int(datetime.now().timestamp() * 1000),
                    testCaseStatus=TestCaseStatus.Success,
                    failedRows=0,
                    # we use approximations becuase the sampling is not deterministic
                    passedRows=IsApprox(59, delta=60) & IsPositiveInt,
                ),
                TableProfilerConfig(
                    profileSampleType=ProfileSampleType.PERCENTAGE,
                    profileSample=10,
                ),
            ),
            (
                TestCaseDefinition(
                    name="compare_same_tables_with_row_sample",
                    testDefinitionName="tableDiff",
                    computePassedFailedRowCount=True,
                    parameterValues=[
                        TestCaseParameterValue(
                            name="keyColumns", value="['customer_id']"
                        ),
                    ],
                ),
                "POSTGRES_SERVICE.dvdrental.public.customer",
                TestCaseResult.model_construct(
                    timestamp=int(datetime.now().timestamp() * 1000),
                    testCaseStatus=TestCaseStatus.Success,
                    failedRows=0,
                    # we use approximations around the 99.5 confidence interval since the
                    # sampling in data diff uses hash based partitioning
                    passedRows=IsApprox(10, delta=15) & IsPositiveInt,
                ),
                TableProfilerConfig(
                    profileSampleType=ProfileSampleType.ROWS,
                    profileSample=10,
                ),
            ),
            (
                TestCaseDefinition(
                    name="with_explicit_key_columns",
                    testDefinitionName="tableDiff",
                    computePassedFailedRowCount=True,
                    parameterValues=[
                        TestCaseParameterValue(
                            name="keyColumns", value="['customer_id']"
                        ),
                    ],
                ),
                "POSTGRES_SERVICE.dvdrental.public.changed_customer",
                TestCaseResult(
                    timestamp=int(datetime.now().timestamp() * 1000),
                    testCaseStatus=TestCaseStatus.Failed,
                    failedRows=321,
                    passedRows=278,
                ),
            ),
            (
                TestCaseDefinition(
                    name="resolve_primary_keys",
                    testDefinitionName="tableDiff",
                    computePassedFailedRowCount=True,
                    parameterValues=[],
                ),
                "POSTGRES_SERVICE.dvdrental.public.changed_customer",
                TestCaseResult(
                    timestamp=int(datetime.now().timestamp() * 1000),
                    testCaseStatus=TestCaseStatus.Failed,
                    failedRows=321,
                    passedRows=278,
                ),
            ),
            (
                TestCaseDefinition(
                    name="with_passing_threshold",
                    testDefinitionName="tableDiff",
                    parameterValues=[
                        TestCaseParameterValue(name="threshold", value="322"),
                    ],
                ),
                "POSTGRES_SERVICE.dvdrental.public.changed_customer",
                TestCaseResult(
                    timestamp=int(datetime.now().timestamp() * 1000),
                    testCaseStatus=TestCaseStatus.Success,
                    failedRows=321,
                ),
            ),
            (
                TestCaseDefinition(
                    name="with_failing_threshold",
                    testDefinitionName="tableDiff",
                    parameterValues=[
                        TestCaseParameterValue(name="threshold", value="321"),
                    ],
                ),
                "POSTGRES_SERVICE.dvdrental.public.changed_customer",
                TestCaseResult(
                    timestamp=int(datetime.now().timestamp() * 1000),
                    testCaseStatus=TestCaseStatus.Failed,
                    failedRows=321,
                ),
            ),
            (
                TestCaseDefinition(
                    name="with_where_clause",
                    testDefinitionName="tableDiff",
                    computePassedFailedRowCount=True,
                    parameterValues=[
                        TestCaseParameterValue(
                            name="where",
                            value="MOD(customer_id, 2) != 0 AND MOD(customer_id, 13) != 0",
                        ),
                    ],
                ),
                "POSTGRES_SERVICE.dvdrental.public.changed_customer",
                TestCaseResult(
                    timestamp=int(datetime.now().timestamp() * 1000),
                    testCaseStatus=TestCaseStatus.Success,
                ),
            ),
            (
                TestCaseDefinition(
                    name="without_first_name",
                    testDefinitionName="tableDiff",
                    computePassedFailedRowCount=True,
                    parameterValues=[],
                ),
                "POSTGRES_SERVICE.dvdrental.public.customer_without_first_name",
                TestCaseResult(
                    timestamp=int(datetime.now().timestamp() * 1000),
                    testCaseStatus=TestCaseStatus.Failed,
                    failedRows=0,
                    passedRows=599,
                    testResultValue=[
                        TestResultValue(name="removedRows", value="0"),
                        TestResultValue(name="addedRows", value="0"),
                        TestResultValue(name="changedRows", value="0"),
                        TestResultValue(name="diffCount", value="0"),
                        TestResultValue(name="removedColumns", value="1"),
                        TestResultValue(name="addedColumns", value="0"),
                        TestResultValue(name="changedColumns", value="0"),
                        TestResultValue(
                            name="schemaTable1",
                            value="serviceType='Postgres' fullyQualifiedTableName='POSTGRES_SERVICE.dvdrental.public.customer' schema={'customer_id': {'type': 'integer', 'constraints': 'PRIMARY_KEY'}, 'store_id': {'type': 'smallint', 'constraints': 'NOT_NULL'}, 'first_name': {'type': 'character varying(45)', 'constraints': 'NOT_NULL'}, 'last_name': {'type': 'character varying(45)', 'constraints': 'NOT_NULL'}, 'email': {'type': 'character varying(50)', 'constraints': 'NULL'}, 'address_id': {'type': 'smallint', 'constraints': 'NOT_NULL'}, 'activebool': {'type': 'boolean', 'constraints': 'NOT_NULL'}, 'create_date': {'type': 'date', 'constraints': 'NOT_NULL'}, 'last_update': {'type': 'timestamp without time zone', 'constraints': 'NULL'}, 'active': {'type': 'integer', 'constraints': 'NULL'}, 'json_field': {'type': 'jsonb', 'constraints': 'NULL'}}",
                        ),
                        TestResultValue(
                            name="schemaTable2",
                            value="serviceType='Postgres' fullyQualifiedTableName='POSTGRES_SERVICE.dvdrental.public.customer_without_first_name' schema={'customer_id': {'type': 'integer', 'constraints': 'NULL'}, 'store_id': {'type': 'smallint', 'constraints': 'NULL'}, 'last_name': {'type': 'character varying(45)', 'constraints': 'NULL'}, 'email': {'type': 'character varying(50)', 'constraints': 'NULL'}, 'address_id': {'type': 'smallint', 'constraints': 'NULL'}, 'activebool': {'type': 'boolean', 'constraints': 'NULL'}, 'create_date': {'type': 'date', 'constraints': 'NULL'}, 'last_update': {'type': 'timestamp without time zone', 'constraints': 'NULL'}, 'active': {'type': 'integer', 'constraints': 'NULL'}, 'json_field': {'type': 'jsonb', 'constraints': 'NULL'}}",
                        ),
                    ],
                ),
            ),
            (
                TestCaseDefinition(
                    name="without_first_name_with_extra_column",
                    testDefinitionName="tableDiff",
                    computePassedFailedRowCount=True,
                    parameterValues=[
                        TestCaseParameterValue(
                            name="useColumns", value="['last_name', 'email']"
                        )
                    ],
                ),
                "POSTGRES_SERVICE.dvdrental.public.customer_without_first_name",
                TestCaseResult(
                    timestamp=int(datetime.now().timestamp() * 1000),
                    testCaseStatus=TestCaseStatus.Success,
                ),
            ),
            (
                TestCaseDefinition(
                    name="postgres_vs_mysql_success",
                    testDefinitionName="tableDiff",
                    computePassedFailedRowCount=True,
                    parameterValues=[
                        TestCaseParameterValue(
                            name="useColumns",
                            value=str(
                                [
                                    "store_id",
                                    "first_name",
                                    "last_name",
                                    "email",
                                    "activebool",
                                    "address_id",
                                    "active",
                                    # "create_date", # date types are incomparable for mysql and postgres
                                    "last_update",
                                ]
                            ),
                        )
                    ],
                ),
                "MYSQL_SERVICE.default.test.customer",
                TestCaseResult(
                    timestamp=int(datetime.now().timestamp() * 1000),
                    testCaseStatus=TestCaseStatus.Success,
                ),
            ),
            (
                TestCaseDefinition(
                    name="postgres_vs_mysql_failure",
                    testDefinitionName="tableDiff",
                    computePassedFailedRowCount=True,
                    parameterValues=[],
                ),
                "MYSQL_SERVICE.default.test.changed_customer",
                TestCaseResult(
                    timestamp=int(datetime.now().timestamp() * 1000),
                    testCaseStatus=TestCaseStatus.Failed,
                ),
            ),
            (
                TestCaseDefinition(
                    name="postgres_different_case_columns_fail",
                    testDefinitionName="tableDiff",
                    computePassedFailedRowCount=True,
                    parameterValues=[
                        TestCaseParameterValue(
                            name="caseSensitiveColumns", value="true"
                        )
                    ],
                ),
                "POSTGRES_SERVICE.dvdrental.public.customer_different_case_columns",
                TestCaseResult(
                    timestamp=int(datetime.now().timestamp() * 1000),
                    testCaseStatus=TestCaseStatus.Failed,
                    failedRows=0,
                    passedRows=599,
                    testResultValue=[
                        TestResultValue(name="removedRows", value="0"),
                        TestResultValue(name="addedRows", value="0"),
                        TestResultValue(name="changedRows", value="0"),
                        TestResultValue(name="diffCount", value="0"),
                        TestResultValue(name="removedColumns", value="1"),
                        TestResultValue(name="addedColumns", value="1"),
                        TestResultValue(name="changedColumns", value="0"),
                        TestResultValue(
                            name="schemaTable1",
                            value="serviceType='Postgres' fullyQualifiedTableName='POSTGRES_SERVICE.dvdrental.public.customer' schema={'customer_id': {'type': 'integer', 'constraints': 'PRIMARY_KEY'}, 'store_id': {'type': 'smallint', 'constraints': 'NOT_NULL'}, 'first_name': {'type': 'character varying(45)', 'constraints': 'NOT_NULL'}, 'last_name': {'type': 'character varying(45)', 'constraints': 'NOT_NULL'}, 'email': {'type': 'character varying(50)', 'constraints': 'NULL'}, 'address_id': {'type': 'smallint', 'constraints': 'NOT_NULL'}, 'activebool': {'type': 'boolean', 'constraints': 'NOT_NULL'}, 'create_date': {'type': 'date', 'constraints': 'NOT_NULL'}, 'last_update': {'type': 'timestamp without time zone', 'constraints': 'NULL'}, 'active': {'type': 'integer', 'constraints': 'NULL'}, 'json_field': {'type': 'jsonb', 'constraints': 'NULL'}}",
                        ),
                        TestResultValue(
                            name="schemaTable2",
                            value="serviceType='Postgres' fullyQualifiedTableName='POSTGRES_SERVICE.dvdrental.public.customer_different_case_columns' schema={'customer_id': {'type': 'integer', 'constraints': 'NULL'}, 'store_id': {'type': 'smallint', 'constraints': 'NULL'}, 'First_Name': {'type': 'character varying(45)', 'constraints': 'NULL'}, 'last_name': {'type': 'character varying(45)', 'constraints': 'NULL'}, 'email': {'type': 'character varying(50)', 'constraints': 'NULL'}, 'address_id': {'type': 'smallint', 'constraints': 'NULL'}, 'activebool': {'type': 'boolean', 'constraints': 'NULL'}, 'create_date': {'type': 'date', 'constraints': 'NULL'}, 'last_update': {'type': 'timestamp without time zone', 'constraints': 'NULL'}, 'active': {'type': 'integer', 'constraints': 'NULL'}, 'json_field': {'type': 'jsonb', 'constraints': 'NULL'}}",
                        ),
                    ],
                ),
            ),
            (
                TestCaseDefinition(
                    name="postgres_different_case_columns_success",
                    testDefinitionName="tableDiff",
                    computePassedFailedRowCount=True,
                    parameterValues=[
                        TestCaseParameterValue(
                            name="caseSensitiveColumns", value="false"
                        )
                    ],
                ),
                "POSTGRES_SERVICE.dvdrental.public.customer_different_case_columns",
                TestCaseResult(
                    timestamp=int(datetime.now().timestamp() * 1000),
                    testCaseStatus=TestCaseStatus.Success,
                ),
                TableProfilerConfig(
                    profileSampleType=ProfileSampleType.PERCENTAGE,
                    profileSample=10,
                ),
            ),
            (
                TestCaseDefinition(
                    name="table_from_another_db",
                    testDefinitionName="tableDiff",
                    computePassedFailedRowCount=True,
                    parameterValues=[],
                ),
                "POSTGRES_SERVICE.other_db.public.customer",
                TestCaseResult(
                    timestamp=int(datetime.now().timestamp() * 1000),
                    testCaseStatus=TestCaseStatus.Failed,
                ),
            ),
        ]
    ],
)
def test_happy_paths(
    postgres_service: DatabaseService,
    prepare_data,
    ingest_postgres_metadata,
    ingest_mysql_service,
    patched_metadata,
    parameters: TestParameters,
    sink_config,
    profiler_config,
    run_workflow,
    workflow_config,
    cleanup_fqns,
):
    # Replace service name placeholders in expected testResultValue
    if parameters.expected.testResultValue:
        for result_value in parameters.expected.testResultValue:
            if result_value.value:
                result_value.value = result_value.value.replace(
                    "POSTGRES_SERVICE", postgres_service.fullyQualifiedName.root
                )

    metadata = patched_metadata
    table1: Table = metadata.get_by_name(
        Table,
        f"{postgres_service.fullyQualifiedName.root}.dvdrental.public.customer",
        nullable=False,
    )
    cleanup_fqns(
        TestCase,
        f"{table1.fullyQualifiedName.root}.{parameters.test_case_defintion.name}",
    )
    table2_service = {
        "POSTGRES_SERVICE": postgres_service,
        "MYSQL_SERVICE": ingest_mysql_service,
    }
    for k, v in table2_service.items():
        parameters.table2_fqn = parameters.table2_fqn.replace(
            k, v.fullyQualifiedName.root
        )
    parameters.test_case_defintion.parameterValues.extend(
        [
            TestCaseParameterValue(
                name="table2",
                value=parameters.table2_fqn,
            ),
        ]
    )
    if parameters.table_profile_config:
        metadata.create_or_update_table_profiler_config(
            table1.fullyQualifiedName.root, parameters.table_profile_config
        )
    workflow_config = {
        "source": {
            "type": "postgres",
            "serviceName": f"MyTestSuite_{postgres_service.name.root}",
            "sourceConfig": {
                "config": {
                    "type": TestSuiteConfigType.TestSuite.value,
                    "entityFullyQualifiedName": table1.fullyQualifiedName.root,
                }
            },
        },
        "processor": {
            "type": "orm-test-runner",
            "config": {"testCases": [parameters.test_case_defintion.model_dump()]},
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }
    run_workflow(TestSuiteWorkflow, workflow_config)
    metadata.create_or_update_table_profiler_config(
        table1.fullyQualifiedName.root, TableProfilerConfig()
    )
    test_case_entity = metadata.get_by_name(
        TestCase,
        f"{table1.fullyQualifiedName.root}.{parameters.test_case_defintion.name}",
        fields=["*"],
    )
    assert "ERROR: Unexpected error" not in test_case_entity.testCaseResult.result
    parameters.expected.timestamp = (
        test_case_entity.testCaseResult.timestamp
    )  # timestamp is not deterministic
    assert_equal_pydantic_objects(parameters.expected, test_case_entity.testCaseResult)


@pytest.mark.parametrize(
    "parameters,expected",
    [
        pytest.param(
            TestCaseDefinition(
                name="unsupported_dialect",
                testDefinitionName="tableDiff",
                computePassedFailedRowCount=True,
                parameterValues=[
                    TestCaseParameterValue(
                        name="service2Url",
                        value="mongodb://localhost:27017",
                    ),
                    TestCaseParameterValue(
                        name="table2",
                        value="POSTGRES_SERVICE.dvdrental.public.customer",
                    ),
                ],
            ),
            TestCaseResult(
                timestamp=int(datetime.now().timestamp() * 1000),
                testCaseStatus=TestCaseStatus.Aborted,
                result="Unsupported dialect in param table2.serviceUrl: mongodb",
            ),
            id="unsupported_dialect",
        ),
        pytest.param(
            TestCaseDefinition(
                name="unsupported_data_types",
                testDefinitionName="tableDiff",
                computePassedFailedRowCount=True,
                parameterValues=[
                    TestCaseParameterValue(
                        name="table2",
                        value="POSTGRES_SERVICE.dvdrental.public.customer_int_first_name",
                    ),
                ],
            ),
            TestCaseResult(
                timestamp=int(datetime.now().timestamp() * 1000),
                testCaseStatus=TestCaseStatus.Failed,
                failedRows=0,
                passedRows=599,
                testResultValue=[
                    TestResultValue(name="removedRows", value="0"),
                    TestResultValue(name="addedRows", value="0"),
                    TestResultValue(name="changedRows", value="0"),
                    TestResultValue(name="diffCount", value="0"),
                    TestResultValue(name="removedColumns", value="0"),
                    TestResultValue(name="addedColumns", value="0"),
                    TestResultValue(name="changedColumns", value="1"),
                    TestResultValue(
                        name="schemaTable1",
                        value="serviceType='Postgres' fullyQualifiedTableName='POSTGRES_SERVICE.dvdrental.public.customer' schema={'customer_id': {'type': 'integer', 'constraints': 'PRIMARY_KEY'}, 'store_id': {'type': 'smallint', 'constraints': 'NOT_NULL'}, 'first_name': {'type': 'character varying(45)', 'constraints': 'NOT_NULL'}, 'last_name': {'type': 'character varying(45)', 'constraints': 'NOT_NULL'}, 'email': {'type': 'character varying(50)', 'constraints': 'NULL'}, 'address_id': {'type': 'smallint', 'constraints': 'NOT_NULL'}, 'activebool': {'type': 'boolean', 'constraints': 'NOT_NULL'}, 'create_date': {'type': 'date', 'constraints': 'NOT_NULL'}, 'last_update': {'type': 'timestamp without time zone', 'constraints': 'NULL'}, 'active': {'type': 'integer', 'constraints': 'NULL'}, 'json_field': {'type': 'jsonb', 'constraints': 'NULL'}}",
                    ),
                    TestResultValue(
                        name="schemaTable2",
                        value="serviceType='Postgres' fullyQualifiedTableName='POSTGRES_SERVICE.dvdrental.public.customer_int_first_name' schema={'customer_id': {'type': 'integer', 'constraints': 'NULL'}, 'store_id': {'type': 'smallint', 'constraints': 'NULL'}, 'last_name': {'type': 'character varying(45)', 'constraints': 'NULL'}, 'email': {'type': 'character varying(50)', 'constraints': 'NULL'}, 'address_id': {'type': 'smallint', 'constraints': 'NULL'}, 'activebool': {'type': 'boolean', 'constraints': 'NULL'}, 'create_date': {'type': 'date', 'constraints': 'NULL'}, 'last_update': {'type': 'timestamp without time zone', 'constraints': 'NULL'}, 'active': {'type': 'integer', 'constraints': 'NULL'}, 'json_field': {'type': 'jsonb', 'constraints': 'NULL'}, 'first_name': {'type': 'integer', 'constraints': 'NULL'}}",
                    ),
                ],
            ),
        ),
        pytest.param(
            None,
            None,
            marks=pytest.mark.skip(
                reason="TODO: implement test - table2 does not exist"
            ),
        ),
        pytest.param(
            None,
            None,
            marks=pytest.mark.skip(
                reason="TODO: implement test - where clause is invalid"
            ),
        ),
    ],
)
def test_error_paths(
    parameters: TestCaseDefinition,
    expected: TestCaseResult,
    prepare_data: None,
    ingest_postgres_metadata,
    ingest_mysql_service: DatabaseService,
    postgres_service: DatabaseService,
    patched_metadata: OpenMetadata,
    sink_config,
    workflow_config,
    run_workflow,
    cleanup_fqns,
):
    # Replace service name placeholders in expected testResultValue
    if expected.testResultValue:
        for result_value in expected.testResultValue:
            if result_value.value:
                result_value.value = result_value.value.replace(
                    "POSTGRES_SERVICE", postgres_service.fullyQualifiedName.root
                )

    metadata = patched_metadata
    table1 = metadata.get_by_name(
        Table,
        f"{postgres_service.fullyQualifiedName.root}.dvdrental.public.customer",
        nullable=False,
    )
    cleanup_fqns(TestCase, f"{table1.fullyQualifiedName.root}.{parameters.name}")
    for parameter in parameters.parameterValues:
        if parameter.name == "table2":
            parameter.value = parameter.value.replace(
                "POSTGRES_SERVICE", postgres_service.fullyQualifiedName.root
            )
    workflow_config = {
        "source": {
            "type": "postgres",
            "serviceName": f"MyTestSuite_{postgres_service.name.root}",
            "sourceConfig": {
                "config": {
                    "type": TestSuiteConfigType.TestSuite.value,
                    "entityFullyQualifiedName": table1.fullyQualifiedName.root,
                }
            },
        },
        "processor": {
            "type": "orm-test-runner",
            "config": {"testCases": [parameters.dict()]},
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }
    run_workflow(TestSuiteWorkflow, workflow_config)
    test_case_entity: TestCase = metadata.get_or_create_test_case(
        f"{table1.fullyQualifiedName.root}.{parameters.name}"
    )
    expected.timestamp = (
        test_case_entity.testCaseResult.timestamp
    )  # timestamp is not deterministic
    assert_equal_pydantic_objects(expected, test_case_entity.testCaseResult)


def add_changed_tables(connection: Connection):
    connection.execute("CREATE TABLE customer_200 AS SELECT * FROM customer LIMIT 200;")
    connection.execute(
        "CREATE TABLE customer_different_case_columns AS SELECT * FROM customer;"
    )
    connection.execute(
        'ALTER TABLE customer_different_case_columns RENAME COLUMN first_name TO "First_Name";'
    )
    # TODO: this appears to be unsupported by data diff. Cross data type comparison is flaky.
    # connection.execute(
    #     "ALTER TABLE customer_different_case_columns ALTER COLUMN store_id TYPE decimal"
    # )
    connection.execute("CREATE TABLE changed_customer AS SELECT * FROM customer;")
    connection.execute(
        "UPDATE changed_customer SET first_name = 'John' WHERE MOD(customer_id, 2) = 0;"
    )
    connection.execute("DELETE FROM changed_customer WHERE MOD(customer_id, 13) = 0;")
    connection.execute(
        "CREATE TABLE customer_without_first_name AS SELECT * FROM customer;"
    )
    connection.execute(
        "ALTER TABLE customer_without_first_name DROP COLUMN first_name;"
    )
    connection.execute(
        "CREATE TABLE customer_int_first_name AS SELECT * FROM customer;"
    )
    connection.execute("ALTER TABLE customer_int_first_name DROP COLUMN first_name;")
    connection.execute("ALTER TABLE customer_int_first_name ADD COLUMN first_name INT;")
    connection.execute("UPDATE customer_int_first_name SET first_name = 1;")


@pytest.fixture(scope="module")
def prepare_data(postgres_container, mysql_container):
    dvdrental = create_engine(
        make_url(postgres_container.get_connection_url()).set(database="dvdrental"),
        isolation_level="AUTOCOMMIT",
    )
    dvdrental.execute("CREATE DATABASE other_db")
    with dvdrental.connect() as conn:
        add_changed_tables(conn)
    other = create_engine(
        make_url(postgres_container.get_connection_url()).set(database="other_db"),
        isolation_level="AUTOCOMMIT",
    )
    copy_table_between_postgres(dvdrental, other, "customer", 10)
    mysql_container = create_engine(
        make_url(mysql_container.get_connection_url()).set(
            database=mysql_container.dbname
        )
    )
    dvdrental = create_engine(
        make_url(postgres_container.get_connection_url()).set(database="dvdrental")
    )
    copy_table(dvdrental, mysql_container, "customer")
    copy_table(dvdrental, mysql_container, "changed_customer")


def copy_table(source_engine, destination_engine, table_name):
    source_metadata = MetaData()
    source_table = SQATable(table_name, source_metadata, autoload_with=source_engine)
    destination_metadata = MetaData()
    destination_table = SQATable(table_name, destination_metadata)

    for column in source_table.columns:
        # we copy all the columns without constraints, indexes or defaults
        # as we are only interested in the data
        if (
            isinstance(column.type, postgresql.base.BYTEA)
            and destination_engine.dialect.name == "mssql"
        ):
            column_copy = SQAColumn(column.name, VARBINARY)
        elif (
            isinstance(column.type, sqltypes.BOOLEAN)
            and destination_engine.dialect.name == "mssql"
        ):
            column_copy = SQAColumn(column.name, sqltypes.Boolean)
        elif (
            isinstance(column.type, sqltypes.TIMESTAMP)
            and destination_engine.dialect.name == "mssql"
        ):
            column_copy = SQAColumn(column.name, sqltypes.DateTime)
        elif (
            isinstance(column.type, sqltypes.DATE)
            and destination_engine.dialect.name == "mssql"
        ):
            column_copy = SQAColumn(column.name, sqltypes.DateTime)
        elif isinstance(column.type, postgresql.json.JSONB):
            column_copy = SQAColumn(column.name, sqltypes.JSON)
        else:
            column_copy = SQAColumn(column.name, column.type)
        destination_table.append_column(column_copy)
    destination_metadata.create_all(destination_engine)
    with source_engine.connect() as source_connection, destination_engine.connect() as destination_connection:
        data = source_connection.execute(source_table.select()).fetchall()
        batch_size = 1000
        for i in range(0, len(data), batch_size):
            batch = data[i : i + batch_size]
            destination_connection.execute(
                source_table.insert(), [dict(row) for row in batch]
            )


@pytest.fixture
def patched_metadata(metadata, postgres_service, ingest_mysql_service, monkeypatch):
    dbs_by_name = {
        service.fullyQualifiedName.root: service
        for service in [postgres_service, ingest_mysql_service]
    }

    def override_result_by_fqn(func):
        def inner(*args, **kwargs):
            result = func(*args, **kwargs)
            if result.fullyQualifiedName.root in dbs_by_name:
                return dbs_by_name[result.fullyQualifiedName.root]
            return result

        return inner

    monkeypatch.setattr(
        "metadata.ingestion.ometa.ometa_api.OpenMetadata.get_by_name",
        override_result_by_fqn(OpenMetadata.get_by_name),
    )

    monkeypatch.setattr(
        "metadata.ingestion.ometa.ometa_api.OpenMetadata.get_by_id",
        override_result_by_fqn(OpenMetadata.get_by_id),
    )

    return metadata


def copy_table_between_postgres(
    source_conn: Connection, dest_conn: Connection, table_name: str, limit: int
):
    # Reflect the source table
    source_metadata = MetaData()
    source_table = SQATable(table_name, source_metadata, autoload_with=source_conn)

    # Create the destination table
    dest_metadata = MetaData()
    dest_table = SQATable(table_name, dest_metadata)

    for column in source_table.columns:
        dest_table.append_column(column.copy())

    dest_metadata.create_all(dest_conn)

    # Fetch data from the source table
    query = source_table.select().limit(limit)
    data = source_conn.execute(query).fetchall()

    # Insert data into the destination table
    if data:
        dest_conn.execute(dest_table.insert(), [dict(row) for row in data])

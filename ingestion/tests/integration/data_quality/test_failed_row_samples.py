"""
Integration tests for failed row sampling.

Runs data quality tests against a PostgreSQL database and asserts that
failed row samples are published for failing tests and not for passing tests.
"""

from typing import List, Optional

import pandas as pd
import pytest

from _openmetadata_testutils.helpers.assumption import Assumption, assume
from metadata.data_quality.api.models import (
    TestCaseDefinition,
    TestSuiteProcessorConfig,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuiteConfigType,
)
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT
from metadata.workflow.data_quality import TestSuiteWorkflow
from metadata.workflow.metadata import MetadataWorkflow


class SampleDataParameters(BaseModel):
    class Config:
        arbitrary_types_allowed = True

    test_case_definition: TestCaseDefinition
    assumptions: List[Assumption]
    table: str = "customer"
    expected_query: Optional[str] = None

    def __init__(self, *args, **kwargs):
        if args:
            field_names = list(self.__annotations__.keys())
            kwargs.update(dict(zip(field_names, args)))
        super().__init__(**kwargs)


class HasColumn(Assumption):
    def __init__(self, column_name: str):
        super().__init__()
        self.column_name = column_name

    def assume_positive(self, df):
        assert self.column_name in df.columns


class HasExactlyColumns(Assumption):
    def __init__(self, num_columns: int):
        super().__init__()
        self.num_columns = num_columns

    def assume_positive(self, df):
        assert len(df.columns) == self.num_columns


DEFAULT_COLUMNS = [
    "customer_id",
    "store_id",
    "first_name",
    "last_name",
    "email",
    "address_id",
    "activebool",
    "create_date",
    "last_update",
    "active",
    "json_field",
]
DEFAULT_COLUMN_ASSUMPTIONS = [HasColumn(column) for column in DEFAULT_COLUMNS] + [
    HasExactlyColumns(len(DEFAULT_COLUMNS))
]


FAILING_TEST_PARAMS = [
    pytest.param(
        SampleDataParameters(*t),
        id=t[0].name,
    )
    for t in [
        (
            TestCaseDefinition(
                name="email_is_not_null",
                testDefinitionName="columnValuesToBeNotNull",
                columnName="email",
                computePassedFailedRowCount=True,
            ),
            [
                ~assume.notnull("email"),
                assume.arbitrary("customer_id", lambda x: x % 10 == 0),
                *DEFAULT_COLUMN_ASSUMPTIONS,
            ],
            "bad_data_customer",
        ),
        (
            TestCaseDefinition(
                name="customer_id_between_0_100",
                testDefinitionName="columnValuesToBeBetween",
                columnName="customer_id",
                computePassedFailedRowCount=True,
                parameterValues=[
                    TestCaseParameterValue(name="minValue", value="0"),
                    TestCaseParameterValue(name="maxValue", value="100"),
                ],
            ),
            [~assume.between("customer_id", 0, 100), *DEFAULT_COLUMN_ASSUMPTIONS],
        ),
        (
            TestCaseDefinition(
                name="there_is_a_jonnny",
                testDefinitionName="columnValuesToBeInSet",
                columnName="first_name",
                computePassedFailedRowCount=True,
                parameterValues=[
                    TestCaseParameterValue(name="allowedValues", value=str(["Jonnny"])),
                ],
            ),
            [~assume.column_values_in("first_name", ["Jonnny"])],
        ),
        (
            TestCaseDefinition(
                name="assume_there_is_no_tim",
                testDefinitionName="columnValuesToBeNotInSet",
                columnName="first_name",
                computePassedFailedRowCount=True,
                parameterValues=[
                    TestCaseParameterValue(name="forbiddenValues", value=str(["Tim"])),
                ],
            ),
            [
                assume.column_values_in("first_name", ["Tim"]),
                *DEFAULT_COLUMN_ASSUMPTIONS,
            ],
        ),
        (
            TestCaseDefinition(
                name="names_up_to_three_chars",
                testDefinitionName="columnValueLengthsToBeBetween",
                columnName="first_name",
                computePassedFailedRowCount=True,
                parameterValues=[
                    TestCaseParameterValue(name="minLength", value="0"),
                    TestCaseParameterValue(name="maxLength", value="3"),
                ],
            ),
            [
                ~assume.length_between("first_name", 0, 3),
                *DEFAULT_COLUMN_ASSUMPTIONS,
            ],
        ),
        (
            TestCaseDefinition(
                name="name_starts_with_j",
                testDefinitionName="columnValuesToMatchRegex",
                columnName="first_name",
                computePassedFailedRowCount=True,
                parameterValues=[
                    TestCaseParameterValue(name="regex", value="^J"),
                ],
            ),
            [
                ~assume.match_regex("first_name", "^J"),
                *DEFAULT_COLUMN_ASSUMPTIONS,
            ],
        ),
        (
            TestCaseDefinition(
                name="name_does_not_start_with_j",
                testDefinitionName="columnValuesToNotMatchRegex",
                columnName="first_name",
                computePassedFailedRowCount=True,
                parameterValues=[
                    TestCaseParameterValue(name="forbiddenRegex", value="^J"),
                ],
            ),
            [
                assume.match_regex("first_name", "^J"),
                *DEFAULT_COLUMN_ASSUMPTIONS,
            ],
        ),
        (
            TestCaseDefinition(
                name="unique_value_test",
                testDefinitionName="columnValuesToBeUnique",
                columnName="first_name",
                computePassedFailedRowCount=True,
            ),
            [
                ~assume.unique("first_name"),
                *DEFAULT_COLUMN_ASSUMPTIONS,
            ],
        ),
        (
            TestCaseDefinition(
                name="custom_sql_test",
                testDefinitionName="tableCustomSQLQuery",
                parameterValues=[
                    TestCaseParameterValue(
                        name="sqlExpression",
                        value="SELECT *, 'extra_value' as extra_column FROM customer",
                    ),
                    TestCaseParameterValue(name="strategy", value="ROWS"),
                ],
            ),
            [
                *[HasColumn(column) for column in DEFAULT_COLUMNS],
                HasExactlyColumns(len(DEFAULT_COLUMNS) + 1),
                HasColumn("extra_column"),
            ],
        ),
    ]
]


@pytest.fixture(scope="module")
def extra_sql_commands():
    return []


@pytest.fixture(scope="module")
def sql_commands(extra_sql_commands):
    return [
        "CREATE TABLE IF NOT EXISTS bad_data_customer AS SELECT * FROM customer;",
        "UPDATE public.bad_data_customer SET email = NULL WHERE MOD(customer_id, 10) = 0;",
        "UPDATE public.bad_data_customer SET first_name = 'Steveo' WHERE first_name = 'Steve';",
    ] + extra_sql_commands


@pytest.fixture(scope="module")
def prepare_postgres(postgres_container, sql_commands):
    """Execute SQL commands to set up test data in the dvdrental database."""
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine.url import make_url

    engine = create_engine(
        make_url(postgres_container.get_connection_url()).set(database="dvdrental")
    )
    with engine.begin() as conn:
        for command in sql_commands:
            conn.execute(text(command))


@pytest.fixture(scope="module")
def ingest_postgres_metadata(
    prepare_postgres,
    postgres_service,
    metadata: OpenMetadata,
    sink_config,
    workflow_config,
    run_workflow,
):
    """Ingest metadata after preparing the database with test data."""
    wf_config = {
        "source": {
            "type": postgres_service.connection.config.type.value.lower(),
            "serviceName": postgres_service.fullyQualifiedName.root,
            "serviceConnection": postgres_service.connection.model_copy(
                update={
                    "config": postgres_service.connection.config.model_copy(
                        update={"ingestAllDatabases": True}
                    )
                }
            ),
            "sourceConfig": {
                "config": {
                    "schemaFilterPattern": {"excludes": ["information_schema"]},
                }
            },
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }
    run_workflow(MetadataWorkflow, wf_config)


def _run_test_suite(
    metadata: OpenMetadata,
    db_service: DatabaseService,
    table: Table,
    test_case_definitions: list,
    sink_config: dict,
    workflow_config: dict,
    run_workflow,
):
    config = {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": f"MyTestSuite_{db_service.name.root}",
            "sourceConfig": {
                "config": {
                    "type": TestSuiteConfigType.TestSuite.value,
                    "entityFullyQualifiedName": table.fullyQualifiedName.root,
                }
            },
        },
        "processor": {
            "type": "orm-test-runner",
            "config": TestSuiteProcessorConfig(
                testCases=test_case_definitions
            ).model_dump(),
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }
    run_workflow(TestSuiteWorkflow, config)


@pytest.mark.parametrize("parameters", FAILING_TEST_PARAMS)
def test_failing_tests_publish_failed_samples(
    postgres_service: DatabaseService,
    ingest_postgres_metadata,
    patch_passwords_for_db_services,
    metadata: OpenMetadata,
    parameters: SampleDataParameters,
    cleanup_fqns,
    run_workflow,
    sink_config,
    workflow_config,
):
    table: Table = metadata.get_by_name(
        Table,
        f"{postgres_service.fullyQualifiedName.root}.dvdrental.public.{parameters.table}",
        nullable=False,
    )
    _run_test_suite(
        metadata,
        postgres_service,
        table,
        [parameters.test_case_definition],
        sink_config,
        workflow_config,
        run_workflow,
    )
    test_fqn_parts = [table.fullyQualifiedName.root]
    if parameters.test_case_definition.columnName:
        test_fqn_parts.append(parameters.test_case_definition.columnName)
    test_fqn_parts.append(parameters.test_case_definition.name)
    test_case_entity: TestCase = metadata.get_by_name(
        entity=TestCase,
        fqn=".".join(test_fqn_parts),
        fields=["*"],
        nullable=False,
    )
    cleanup_fqns(TestCase, test_case_entity.fullyQualifiedName.root)
    assert test_case_entity.testCaseResult.testCaseStatus == TestCaseStatus.Failed
    failed_sample = metadata.get_failed_rows_sample(test_case_entity)
    assert failed_sample is not None
    df = pd.DataFrame(
        failed_sample.rows, columns=[c.root for c in failed_sample.columns]
    )
    assert len(df) <= SAMPLE_DATA_DEFAULT_COUNT
    assert len(df) > 0
    for assumption in parameters.assumptions:
        assumption.validate(df)
    assert test_case_entity.inspectionQuery is not None


def test_passing_tests_dont_publish(
    postgres_service: DatabaseService,
    ingest_postgres_metadata,
    patch_passwords_for_db_services,
    metadata: OpenMetadata,
    cleanup_fqns,
    run_workflow,
    sink_config,
    workflow_config,
):
    table: Table = metadata.get_by_name(
        Table,
        f"{postgres_service.fullyQualifiedName.root}.dvdrental.public.customer",
        nullable=False,
    )
    test_case_definition = TestCaseDefinition(
        name="name_is_not_null",
        testDefinitionName="columnValuesToBeNotNull",
        columnName="first_name",
        computePassedFailedRowCount=True,
    )
    _run_test_suite(
        metadata,
        postgres_service,
        table,
        [test_case_definition],
        sink_config,
        workflow_config,
        run_workflow,
    )
    test_case_entity: TestCase = metadata.get_or_create_test_case(
        f"{table.fullyQualifiedName.root}.{test_case_definition.columnName}.{test_case_definition.name}"
    )
    cleanup_fqns(TestCase, test_case_entity.fullyQualifiedName.root)
    assert test_case_entity.testCaseResult.testCaseStatus == TestCaseStatus.Success
    failed_sample = metadata.get_failed_rows_sample(test_case_entity)
    assert failed_sample is None

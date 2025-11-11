import pytest
from dirty_equals import IsPositiveInt
from sqlalchemy import create_engine

from _openmetadata_testutils.pydantic.test_utils import assert_equal_pydantic_objects
from metadata.data_quality.api.models import TestCaseDefinition
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuiteConfigType,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.data_quality import TestSuiteWorkflow
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="module")
def prepare_data(create_test_data, trino_container):
    """Prepare test data by creating tables to compare"""
    # Create test tables in Trino
    engine = create_engine(trino_container.get_connection_url())
    with engine.connect() as conn:
        # Create a copy of the userdata table with modified data
        conn.execute(
            """
            CREATE TABLE minio.my_schema.changed_userdata AS 
            SELECT 
                registration_dttm,
                id,
                CASE WHEN MOD(id, 2) = 0 THEN 'John' ELSE first_name END as first_name,
                last_name,
                email,
                gender,
                ip_address,
                cc,
                country,
                birthdate,
                salary,
                title,
                comments
            FROM minio.my_schema.userdata
            WHERE MOD(id, 13) != 0
        """
        ).fetchall()


@pytest.mark.skip("Skipping while investigating CI failure. Test passes locally.")
@pytest.mark.parametrize(
    "test_case_definition,expected_result",
    [
        (
            TestCaseDefinition(
                name="compare_same_tables",
                testDefinitionName="tableDiff",
                computePassedFailedRowCount=True,
                parameterValues=[
                    TestCaseParameterValue(name="keyColumns", value="['id']"),
                    TestCaseParameterValue(
                        name="table2",
                        value="{db_service}.minio.my_schema.userdata",
                    ),
                    TestCaseParameterValue(
                        name="useColumns",
                        value="['id', 'first_name', 'last_name', 'email', 'country', 'salary', 'title']",
                    ),
                ],
            ),
            TestCaseResult.model_construct(
                timestamp=Timestamp.model_construct(root=IsPositiveInt),
                testCaseStatus=TestCaseStatus.Success,
                failedRows=0,
                passedRows=1000,
            ),
        ),
        (
            TestCaseDefinition(
                name="compare_modified_tables",
                testDefinitionName="tableDiff",
                computePassedFailedRowCount=True,
                parameterValues=[
                    TestCaseParameterValue(name="keyColumns", value="['id']"),
                    TestCaseParameterValue(
                        name="table2",
                        value="{db_service}.minio.my_schema.changed_userdata",
                    ),
                    TestCaseParameterValue(
                        name="useColumns",
                        value="['id', 'first_name', 'last_name', 'email', 'country', 'salary', 'title']",
                    ),
                ],
            ),
            TestCaseResult.model_construct(
                timestamp=Timestamp.model_construct(root=IsPositiveInt),
                testCaseStatus=TestCaseStatus.Failed,
                failedRows=535,
                passedRows=465,
            ),
        ),
    ],
    ids=lambda x: getattr(x, "name", None),
)
def test_table_diff(
    test_case_definition,
    expected_result,
    prepare_data,
    db_service: DatabaseService,
    ingestion_config,
    metadata: OpenMetadata,
    sink_config,
    workflow_config,
    run_workflow,
    cleanup_fqns,
):
    """Test table diff functionality with Trino tables"""

    # Run metadata ingestion first
    run_workflow(MetadataWorkflow, ingestion_config)

    # Get the source table
    table1: Table = metadata.get_by_name(
        Table,
        f"{db_service.fullyQualifiedName.root}.minio.my_schema.userdata",
        nullable=False,
    )

    # Update table2 FQN with actual service name
    for param in test_case_definition.parameterValues:
        if param.name == "table2":
            param.value = param.value.format(
                db_service=db_service.fullyQualifiedName.root
            )

    # Configure test suite workflow
    test_suite_config = {
        "source": {
            "type": "trino",
            "serviceName": "MyTestSuite",
            "sourceConfig": {
                "config": {
                    "type": TestSuiteConfigType.TestSuite,
                    "entityFullyQualifiedName": table1.fullyQualifiedName.root,
                    "serviceConnections": [
                        {
                            "serviceName": db_service.name.root,
                            "serviceConnection": db_service.connection.model_dump(),
                        }
                    ],
                },
            },
        },
        "processor": {
            "type": "orm-test-runner",
            "config": {"testCases": [test_case_definition.model_dump()]},
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }

    # Run test suite workflow
    run_workflow(TestSuiteWorkflow, test_suite_config)

    # Verify results
    test_case_entity = metadata.get_by_name(
        TestCase,
        f"{table1.fullyQualifiedName.root}.{test_case_definition.name}",
        fields=["*"],
        nullable=False,
    )
    cleanup_fqns(
        TestCase, f"{table1.fullyQualifiedName.root}.{test_case_definition.name}"
    )

    assert_equal_pydantic_objects(expected_result, test_case_entity.testCaseResult)

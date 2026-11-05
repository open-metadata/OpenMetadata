#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Databend data-quality integration tests."""

from metadata.data_quality.api.models import TestCaseDefinition
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    ServiceConnections,
    TestSuiteConfigType,
    TestSuitePipeline,
)
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.workflow.data_quality import TestSuiteWorkflow
from metadata.workflow.metadata import MetadataWorkflow


def test_column_values_to_be_between(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    db_service,
    metadata,
    sink_config,
    workflow_config,
):
    run_workflow(MetadataWorkflow, ingestion_config)
    table_fqn = f"{db_service.fullyQualifiedName.root}.default.analytics.customers"
    test_definition = TestCaseDefinition(
        name="databend_id_between_1_and_100",
        testDefinitionName="columnValuesToBeBetween",
        columnName="id",
        computePassedFailedRowCount=True,
        parameterValues=[
            TestCaseParameterValue(name="minValue", value="1"),
            TestCaseParameterValue(name="maxValue", value="100"),
        ],
    )
    config = {
        "source": {
            "type": "databend",
            "serviceName": f"MyTestSuite_{db_service.name.root}",
            "sourceConfig": {
                "config": TestSuitePipeline(
                    type=TestSuiteConfigType.TestSuite,
                    entityFullyQualifiedName=FullyQualifiedEntityName(root=table_fqn),
                    serviceConnections=[
                        ServiceConnections(
                            serviceName=db_service.name.root,
                            serviceConnection=db_service.connection,
                        )
                    ],
                )
            },
        },
        "processor": {
            "type": "orm-test-runner",
            "config": {"testCases": [test_definition.model_dump()]},
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }

    run_workflow(TestSuiteWorkflow, config)

    test_case = metadata.get_by_name(
        TestCase,
        f"{table_fqn}.id.{test_definition.name}",
        fields=["*"],
        nullable=False,
    )
    assert test_case.testCaseResult.testCaseStatus == TestCaseStatus.Success
    assert test_case.testCaseResult.failedRows == 0
    assert test_case.testCaseResult.passedRows == 100

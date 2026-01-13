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
"""
Test dbt cloud using the topology
"""
import json
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    SourceUrl,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.pipeline.gluepipeline.metadata import GluepipelineSource

mock_glue_config = {
    "source": {
        "type": "gluepipeline",
        "serviceName": "local_gluepipeline",
        "serviceConnection": {
            "config": {
                "type": "GluePipeline",
                "awsConfig": {
                    "awsAccessKeyId": "aws_access_key_id",
                    "awsSecretAccessKey": "aws_secret_access_key",
                    "awsRegion": "us-east-2",
                    "endPointURL": "https://endpoint.com/",
                },
            },
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}

EXPECTED_JOB_DETAILS = json.loads(
    """
{
    "Name": "redshift workflow",
    "Description": "redshift workflow description",
    "DefaultRunProperties": {},
    "CreatedOn": "2024-09-20 15:46:36.668000",
    "LastModifiedOn": "2024-09-20 15:46:36.668000",
    "LastRun": {
        "Name": "redshift workflow",
        "WorkflowRunId": "wr_6db99d3ea932db0739f03ba5ae56e4b635b7878261f75af062e1223a7272c50e",
        "WorkflowRunProperties": {},
        "StartedOn": "2024-09-30 17:07:24.032000",
        "CompletedOn": "2024-09-30 17:08:24.032000",
        "Status": "COMPLETED",
        "Statistics": {
            "TotalActions": 1,
            "TimeoutActions": 0,
            "FailedActions": 1,
            "StoppedActions": 0,
            "SucceededActions": 0,
            "RunningActions": 0,
            "ErroredActions": 0,
            "WaitingActions": 0
        },
        "Graph": {
            "Nodes": [
                {
                    "Type": "TRIGGER",
                    "Name": "redshift_event",
                    "UniqueId": "wnode_98c85bc1e19d969e35e0687b2ec586822271463c72dd556f90cfe6421a2517ee",
                    "TriggerDetails": {
                        "Trigger": {
                            "Name": "redshift_event",
                            "WorkflowName": "redshift workflow",
                            "Type": "ON_DEMAND",
                            "State": "CREATED",
                            "Actions": [
                                {
                                    "JobName": "Redshift DBT Job"
                                }
                            ]
                        }
                    }
                },
                {
                    "Type": "JOB",
                    "Name": "Redshift DBT Job",
                    "UniqueId": "wnode_0cbf9f52c41002015ebc46fe70a9b0ea64ff7dba891cf141d6dcbf5580fe7123",
                    "JobDetails": {
                        "JobRuns": [
                            {
                                "Id": "jr_108804857dd29cb1857c92d3e8bf0b48f7685c246e56125b713eb6ea7ebfe4e2",
                                "Attempt": 0,
                                "TriggerName": "redshift_event",
                                "JobName": "Redshift DBT Job",
                                "JobMode": "VISUAL",
                                "JobRunQueuingEnabled": false,
                                "StartedOn": "2024-09-30 17:07:59.185000",
                                "LastModifiedOn": "2024-09-30 17:08:03.003000",
                                "CompletedOn": "2024-09-30 17:08:03.003000",
                                "JobRunState": "FAILED",
                                "ErrorMessage": "Error Message",
                                "PredecessorRuns": [],
                                "AllocatedCapacity": 10,
                                "ExecutionTime": 0,
                                "Timeout": 2880,
                                "MaxCapacity": 10.0,
                                "WorkerType": "G.1X",
                                "NumberOfWorkers": 10,
                                "LogGroupName": "/aws-glue/jobs",
                                "GlueVersion": "4.0",
                                "ExecutionClass": "STANDARD"
                            }
                        ]
                    }
                }
            ],
            "Edges": [
                {
                    "SourceId": "wnode_98c85bc1e19d969e35e0687b2ec586822271463c72dd556f90cfe6421a2517ee",
                    "DestinationId": "wnode_0cbf9f52c41002015ebc46fe70a9b0ea64ff7dba891cf141d6dcbf5580fe7123"
                }
            ]
        }
    },
    "Graph": {
        "Nodes": [
            {
                "Type": "TRIGGER",
                "Name": "redshift_event",
                "UniqueId": "wnode_98c85bc1e19d969e35e0687b2ec586822271463c72dd556f90cfe6421a2517ee",
                "TriggerDetails": {
                    "Trigger": {
                        "Name": "redshift_event",
                        "WorkflowName": "redshift workflow",
                        "Type": "ON_DEMAND",
                        "State": "CREATED",
                        "Actions": [
                            {
                                "JobName": "Redshift DBT Job"
                            }
                        ]
                    }
                }
            },
            {
                "Type": "JOB",
                "Name": "Redshift DBT Job",
                "UniqueId": "wnode_0cbf9f52c41002015ebc46fe70a9b0ea64ff7dba891cf141d6dcbf5580fe7123",
                "JobDetails": {}
            }
        ],
        "Edges": [
            {
                "SourceId": "wnode_98c85bc1e19d969e35e0687b2ec586822271463c72dd556f90cfe6421a2517ee",
                "DestinationId": "wnode_0cbf9f52c41002015ebc46fe70a9b0ea64ff7dba891cf141d6dcbf5580fe7123"
            }
        ]
    }
}
"""
)

EXPECTED_CREATED_PIPELINES = CreatePipelineRequest(
    name=EntityName(root="redshift workflow"),
    displayName="redshift workflow",
    sourceUrl=SourceUrl(
        root="https://us-east-2.console.aws.amazon.com/glue/home?region=us-east-2#/v2/etl-configuration/workflows/view/redshift workflow"
    ),
    tasks=[
        Task(
            name="redshift_event",
            displayName="redshift_event",
            downstreamTasks=["Redshift DBT Job"],
            taskType="TRIGGER",
            tags=[],
        ),
        Task(
            name="Redshift DBT Job",
            displayName="Redshift DBT Job",
            downstreamTasks=[],
            taskType="JOB",
            tags=[],
        ),
    ],
    service=FullyQualifiedEntityName(root="gluepipeline_test"),
)

MOCK_PIPELINE_SERVICE = PipelineService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="gluepipeline_test",
    fullyQualifiedName=FullyQualifiedEntityName("gluepipeline_test"),
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.DBTCloud,
)

MOCK_PIPELINE = Pipeline(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name=EntityName(root="redshift workflow"),
    fullyQualifiedName="gluepipeline_test.redshift workflow",
    displayName="OpenMetadata DBTCloud Workflow",
    description=Markdown(root="Example Job Description"),
    sourceUrl=SourceUrl(
        root="https://abc12.us1.dbt.com/deploy/70403103922125/projects/70403103926818/jobs/70403103936332"
    ),
    tasks=[
        Task(
            name="70403110257794",
            sourceUrl=SourceUrl(
                root="https://abc12.us1.dbt.com/deploy/70403103922125/projects/70403103926818/runs/70403110257794/"
            ),
            startDate="2024-05-27 10:42:20.621788+00:00",
            endDate="2024-05-28 10:42:52.622408+00:00",
            tags=[],
        ),
        Task(
            name="70403111615088",
            sourceUrl=SourceUrl(
                root="https://abc12.us1.dbt.com/deploy/70403103922125/projects/70403103926818/runs/70403111615088/"
            ),
            startDate="None",
            endDate="None",
            tags=[],
        ),
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
    scheduleInterval="6 */12 * * 0,1,2,3,4,5,6",
)

EXPECTED_PIPELINE_NAME = "redshift workflow"


class GluePipelineUnitTest(TestCase):
    """
    DBTCloud unit tests
    """

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False

        config = OpenMetadataWorkflowConfig.model_validate(mock_glue_config)
        self.gluepipeline = GluepipelineSource.create(
            mock_glue_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.gluepipeline.context.get().__dict__["pipeline"] = MOCK_PIPELINE.name.root
        self.gluepipeline.context.get().__dict__[
            "pipeline_service"
        ] = MOCK_PIPELINE_SERVICE.name.root

    def test_pipeline_name(self):
        assert (
            self.gluepipeline.get_pipeline_name(EXPECTED_JOB_DETAILS)
            == EXPECTED_PIPELINE_NAME
        )

    def test_pipelines(self):
        pipeline = list(self.gluepipeline.yield_pipeline(EXPECTED_JOB_DETAILS))[0].right
        assert pipeline == EXPECTED_CREATED_PIPELINES

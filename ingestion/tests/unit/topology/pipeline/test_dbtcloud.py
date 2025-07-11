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
import uuid
from datetime import datetime, timedelta
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
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
from metadata.generated.schema.type.usageDetails import UsageDetails, UsageStats
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.dbtcloud.metadata import DbtcloudSource
from metadata.ingestion.source.pipeline.dbtcloud.models import (
    DBTJob,
    DBTJobList,
    DBTModel,
    DBTSchedule,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineUsage

MOCK_JOB_RESULT = json.loads(
    """
{
    "status": {
      "code": 200,
      "is_success": true,
      "user_message": "Success!",
      "developer_message": ""
    },
    "data": [
      {
        "execution": {
          "timeout_seconds": 0
        },
        "generate_docs": false,
        "run_generate_sources": false,
        "run_compare_changes": false,
        "id": 70403103936332,
        "account_id": 70403103922125,
        "project_id": 70403103926818,
        "environment_id": 70403103931988,
        "name": "New job",
        "description": "Example Job Description",
        "dbt_version": null,
        "raw_dbt_version": null,
        "created_at": "2024-05-27T10:42:10.111442+00:00",
        "updated_at": "2024-05-27T10:42:10.111459+00:00",
        "execute_steps": [
          "dbt build",
          "dbt seed",
          "dbt run"
        ],
        "state": 1,
        "deactivated": false,
        "run_failure_count": 0,
        "deferring_job_definition_id": null,
        "deferring_environment_id": null,
        "lifecycle_webhooks": false,
        "lifecycle_webhooks_url": null,
        "triggers": {
          "github_webhook": false,
          "git_provider_webhook": false,
          "schedule": false,
          "on_merge": false
        },
        "settings": {
          "threads": 4,
          "target_name": "default"
        },
        "schedule": {
          "cron": "6 */12 * * 0,1,2,3,4,5,6",
          "date": {
            "type": "interval_cron",
            "days": [
              0,
              1,
              2,
              3,
              4,
              5,
              6
            ],
            "cron": "6 */12 * * 0,1,2,3,4,5,6"
          },
          "time": {
            "type": "every_hour",
            "interval": 12
          }
        },
        "is_deferrable": false,
        "job_type": "other",
        "triggers_on_draft_pr": false,
        "job_completion_trigger_condition": null,
        "generate_sources": false,
        "cron_humanized": "At 6 minutes past the hour, every 12 hours, only on Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, and Saturday",
        "next_run": null,
        "next_run_humanized": null
      }
    ],
    "extra": {
      "filters": {
        "limit": 100,
        "offset": 0,
        "state": "active",
        "account_id": 70403103922125
      },
      "order_by": "id",
      "pagination": {
        "count": 2,
        "total_count": 2
      }
    }
  }
"""
)

MOCK_RUN_RESULT = (
    json.loads(
        """
            {
    "status": {
        "code": 200,
        "is_success": true,
        "user_message": "Success!",
        "developer_message": ""
    },
    "data": [
        {
            "id": 70403110257794,
            "trigger_id": 70403110257797,
            "account_id": 70403103922125,
            "environment_id": 70403103931988,
            "project_id": 70403103926818,
            "job_definition_id": 70403103936332,
            "status": 30,
            "dbt_version": "versionless",
            "git_branch": "main",
            "git_sha": "8d1ef1b22e961221d4ce2892fb296ee3b0be8628",
            "status_message": "This run timed out after running for 1 day, which exceeded the configured timeout of 86400 seconds.",
            "owner_thread_id": null,
            "executed_by_thread_id": "scheduler-run-0-557678648f-g8vzk",
            "deferring_run_id": null,
            "artifacts_saved": true,
            "artifact_s3_path": "prod-us-c1/runs/70403110257794/artifacts/target",
            "has_docs_generated": false,
            "has_sources_generated": false,
            "notifications_sent": true,
            "blocked_by": [],
            "created_at": "2024-05-27 10:42:16.179903+00:00",
            "updated_at": "2024-05-28 10:42:52.705446+00:00",
            "dequeued_at": "2024-05-27 10:42:16.251847+00:00",
            "started_at": "2024-05-27 10:42:20.621788+00:00",
            "finished_at": "2024-05-28 10:42:52.622408+00:00",
            "last_checked_at": "2024-05-28 10:42:52.705356+00:00",
            "last_heartbeat_at": "2024-05-28 10:39:29.406636+00:00",
            "should_start_at": null,
            "trigger": null,
            "job": null,
            "environment": null,
            "run_steps": [],
            "status_humanized": "Cancelled",
            "in_progress": false,
            "is_complete": true,
            "is_success": false,
            "is_error": false,
            "is_cancelled": true,
            "duration": "24:00:36",
            "queued_duration": "00:00:04",
            "run_duration": "24:00:32",
            "duration_humanized": "1 day",
            "queued_duration_humanized": "4 seconds",
            "run_duration_humanized": "1 day",
            "created_at_humanized": "2 weeks, 3 days ago",
            "finished_at_humanized": "2 weeks, 2 days ago",
            "retrying_run_id": null,
            "can_retry": false,
            "retry_not_supported_reason": "RETRY_NOT_FAILED_RUN",
            "job_id": 70403103936332,
            "is_running": null,
            "href": "https://abc12.us1.dbt.com/deploy/70403103922125/projects/70403103926818/runs/70403110257794/",
            "used_repo_cache": null
        },
        {
            "id": 70403111615088,
            "trigger_id": 70403111615091,
            "account_id": 70403103922125,
            "environment_id": 70403103931988,
            "project_id": 70403103926818,
            "job_definition_id": 70403103936332,
            "status": 1,
            "dbt_version": "versionless",
            "git_branch": null,
            "git_sha": null,
            "status_message": null,
            "owner_thread_id": null,
            "executed_by_thread_id": null,
            "deferring_run_id": null,
            "artifacts_saved": false,
            "artifact_s3_path": null,
            "has_docs_generated": false,
            "has_sources_generated": false,
            "notifications_sent": false,
            "blocked_by": [
                70403111611683
            ],
            "created_at": "2024-06-14 04:46:06.929885+00:00",
            "updated_at": "2024-06-14 05:42:48.349018+00:00",
            "dequeued_at": null,
            "started_at": null,
            "finished_at": null,
            "last_checked_at": null,
            "last_heartbeat_at": null,
            "should_start_at": null,
            "trigger": null,
            "job": null,
            "environment": null,
            "run_steps": [],
            "status_humanized": "Queued",
            "in_progress": true,
            "is_complete": false,
            "is_success": false,
            "is_error": false,
            "is_cancelled": false,
            "duration": "00:56:48",
            "queued_duration": "00:56:48",
            "run_duration": "00:00:00",
            "duration_humanized": "56 minutes, 48 seconds",
            "queued_duration_humanized": "56 minutes, 48 seconds",
            "run_duration_humanized": "0 minutes",
            "created_at_humanized": "56 minutes, 48 seconds ago",
            "finished_at_humanized": "0 minutes from now",
            "retrying_run_id": null,
            "can_retry": false,
            "retry_not_supported_reason": "RETRY_NOT_FAILED_RUN",
            "job_id": 70403103936332,
            "is_running": null,
            "href": "https://abc12.us1.dbt.com/deploy/70403103922125/projects/70403103926818/runs/70403111615088/",
            "used_repo_cache": null
        }
    ],
    "extra": {
        "filters": {
            "limit": 100,
            "offset": 0,
            "state": "all",
            "account_id": 70403103922125,
            "job_definition_id": 70403103936332
        },
        "order_by": "id",
        "pagination": {
            "count": 4,
            "total_count": 4
        }
    }
}
        """
    ),
)

MOCK_QUERY_RESULT = json.loads(
    """
{
  "data": {
    "job": {
      "models": [
        {
          "name": "model_11",
          "alias": "stg_payments",
          "database": "dev",
          "schema": "dbt_test_new",
          "rawSql": null,
          "materializedType": "table",
          "parentsSources": [
            {
              "database": "dev",
              "name": "raw_payments",
              "schema": "dbt_test_new"
            }
          ]
        },
        {
          "name": "model_15",
          "alias": "stg_orders",
          "database": "dev",
          "schema": "dbt_test_new",
          "rawSql": null,
          "materializedType": "table",
          "parentsSources": [
            {
              "database": "dev",
              "name": "raw_orders",
              "schema": "dbt_test_new"
            }
          ]
        },
        {
          "name": "model_20",
          "alias": "stg_customers",
          "database": "dev",
          "schema": "dbt_test_new",
          "rawSql": null,
          "materializedType": "table",
          "parentsSources": [
            {
              "database": "dev",
              "name": "raw_customers",
              "schema": "dbt_test_new"
            }
          ]
        },
        {
          "name": "model_3",
          "alias": "customers",
          "database": "dev",
          "schema": "dbt_test_new",
          "rawSql": "SELECT * FROM stg_customers JOIN stg_orders",
          "materializedType": "table",
          "parentsSources": [
            {
              "database": "dev",
              "name": "stg_customers",
              "schema": "dbt_test_new"
            },
            {
              "database": "dev",
              "name": "stg_orders",
              "schema": "dbt_test_new"
            }
          ]
        },
        {
          "name": "model_32",
          "alias": "orders",
          "database": "dev",
          "schema": "dbt_test_new",
          "rawSql": "SELECT * FROM stg_payments JOIN stg_orders",
          "materializedType": "table",
          "parentsSources": [
            {
              "database": "dev",
              "name": "stg_payments",
              "schema": "dbt_test_new"
            },
            {
              "database": "dev",
              "name": "stg_orders",
              "schema": "dbt_test_new"
            }
          ]
        }
      ]
    }
  }
}
"""
)

mock_dbtcloud_config = {
    "source": {
        "type": "dbtcloud",
        "serviceName": "dbtcloud_source",
        "serviceConnection": {
            "config": {
                "type": "DBTCloud",
                "host": "https://abc12.us1.dbt.com",
                "discoveryAPI": "https://metadata.cloud.getdbt.com/graphql",
                "accountId": "70403103922125",
                "jobIds": ["70403103922125", "70403103922126"],
                "projectIds": ["70403103922127", "70403103922128"],
                "numberOfRuns": 10,
                "token": "dbt_token",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "PipelineMetadata",
                "lineageInformation": {"dbServiceNames": ["local_redshift"]},
            }
        },
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

EXPECTED_JOB_DETAILS = DBTJob(
    id=70403103936332,
    name="New job",
    description="Example Job Description",
    created_at="2024-05-27T10:42:10.111442+00:00",
    updated_at="2024-05-27T10:42:10.111459+00:00",
    state=1,
    job_type="other",
    schedule=DBTSchedule(cron="6 */12 * * 0,1,2,3,4,5,6"),
    project_id=70403103926818,
)

EXPECTED_CREATED_PIPELINES = CreatePipelineRequest(
    name=EntityName(root="New job"),
    displayName=None,
    description=Markdown(root="Example Job Description"),
    dataProducts=None,
    sourceUrl=SourceUrl(
        root="https://abc12.us1.dbt.com/deploy/70403103922125/projects/70403103926818/jobs/70403103936332"
    ),
    concurrency=None,
    pipelineLocation=None,
    startDate=None,
    tasks=None,
    tags=None,
    owners=None,
    service=FullyQualifiedEntityName(root="dbtcloud_pipeline_test"),
    extension=None,
    scheduleInterval="6 */12 * * 0,1,2,3,4,5,6",
    domains=None,
    lifeCycle=None,
    sourceHash=None,
)

MOCK_PIPELINE_SERVICE = PipelineService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="dbtcloud_pipeline_test",
    fullyQualifiedName=FullyQualifiedEntityName("dbtcloud_pipeline_test"),
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.DBTCloud,
)

MOCK_PIPELINE = Pipeline(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name=EntityName(root="New job"),
    fullyQualifiedName="dbtcloud_pipeline_test.New job",
    displayName="OpenMetadata DBTCloud Workflow",
    description=Markdown(root="Example Job Description"),
    dataProducts=None,
    sourceUrl=SourceUrl(
        root="https://abc12.us1.dbt.com/deploy/70403103922125/projects/70403103926818/jobs/70403103936332"
    ),
    concurrency=None,
    pipelineLocation=None,
    startDate=None,
    tasks=[
        Task(
            name="70403110257794",
            displayName=None,
            fullyQualifiedName=None,
            description=None,
            sourceUrl=SourceUrl(
                root="https://abc12.us1.dbt.com/deploy/70403103922125/projects/70403103926818/runs/70403110257794/"
            ),
            downstreamTasks=None,
            taskType=None,
            taskSQL=None,
            startDate="2024-05-27 10:42:20.621788+00:00",
            endDate="2024-05-28 10:42:52.622408+00:00",
            tags=None,
            owners=None,
        ),
        Task(
            name="70403111615088",
            displayName=None,
            fullyQualifiedName=None,
            description=None,
            sourceUrl=SourceUrl(
                root="https://abc12.us1.dbt.com/deploy/70403103922125/projects/70403103926818/runs/70403111615088/"
            ),
            downstreamTasks=None,
            taskType=None,
            taskSQL=None,
            startDate="None",
            endDate="None",
            tags=None,
            owners=None,
        ),
    ],
    tags=None,
    owners=None,
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
    extension=None,
    scheduleInterval="6 */12 * * 0,1,2,3,4,5,6",
    domains=None,
    lifeCycle=None,
    sourceHash=None,
)

EXPECTED_JOB_FILTERS = ["70403103922125", "70403103922126"]

EXPECTED_PROJECT_FILTERS = ["70403103922127", "70403103922128"]

EXPECTED_PIPELINE_NAME = str(MOCK_JOB_RESULT["data"][0]["name"])


class DBTCloudUnitTest(TestCase):
    """
    DBTCloud unit tests
    """

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False

        config = OpenMetadataWorkflowConfig.model_validate(mock_dbtcloud_config)
        self.dbtcloud = DbtcloudSource.create(
            mock_dbtcloud_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.dbtcloud.context.get().__dict__["pipeline"] = MOCK_PIPELINE.name.root
        self.dbtcloud.context.get().__dict__[
            "pipeline_service"
        ] = MOCK_PIPELINE_SERVICE.name.root
        self.dbtcloud.metadata = OpenMetadata(
            config.workflowConfig.openMetadataServerConfig
        )
        self.metadata = OpenMetadata(
            OpenMetadataConnection.model_validate(
                mock_dbtcloud_config["workflowConfig"]["openMetadataServerConfig"]
            )
        )

    @patch("metadata.ingestion.source.pipeline.dbtcloud.client.DBTCloudClient.get_jobs")
    def test_get_pipelines_list(self, get_jobs):
        get_jobs.return_value = DBTJobList(**MOCK_JOB_RESULT).Jobs
        results = list(self.dbtcloud.get_pipelines_list())
        self.assertEqual([EXPECTED_JOB_DETAILS], results)

    def test_pipeline_name(self):
        assert (
            self.dbtcloud.get_pipeline_name(EXPECTED_JOB_DETAILS)
            == EXPECTED_PIPELINE_NAME
        )

    def test_filters_to_list(self):
        assert self.dbtcloud.client.job_ids == EXPECTED_JOB_FILTERS
        assert self.dbtcloud.client.project_ids == EXPECTED_PROJECT_FILTERS

    def test_pipelines(self):
        """
        Test pipeline creation
        """
        pipeline = list(self.dbtcloud.yield_pipeline(EXPECTED_JOB_DETAILS))[0].right

        # Compare individual fields instead of entire objects
        self.assertEqual(pipeline.name, EXPECTED_CREATED_PIPELINES.name)
        self.assertEqual(pipeline.description, EXPECTED_CREATED_PIPELINES.description)
        self.assertEqual(pipeline.sourceUrl, EXPECTED_CREATED_PIPELINES.sourceUrl)
        self.assertEqual(
            pipeline.scheduleInterval, EXPECTED_CREATED_PIPELINES.scheduleInterval
        )
        self.assertEqual(pipeline.service, EXPECTED_CREATED_PIPELINES.service)

    def test_yield_pipeline_usage(self):
        """
        Validate the logic for existing or new usage
        """

        self.dbtcloud.context.get().__dict__["pipeline"] = "pipeline_name"

        # Start checking pipeline without usage
        # and a view count
        return_value = Pipeline(
            id=uuid.uuid4(),
            name="pipeline_name",
            fullyQualifiedName="pipeline_service.pipeline_name",
            service=EntityReference(id=uuid.uuid4(), type="pipelineService"),
            tasks=[
                Task(
                    name="task1",
                    startDate=self.dbtcloud.today,
                    endDate="2025-02-19 11:09:36.920915+00:00",
                ),
                Task(
                    name="task2",
                    startDate="2025-02-19 11:08:24.326771+00:00",
                    endDate=self.dbtcloud.today,
                ),
                Task(
                    name="task3",
                    startDate="2025-02-19 11:08:24.326771+00:00",
                    endDate="2025-02-19 11:09:36.920915+00:00",
                ),
            ],
        )
        with patch.object(OpenMetadata, "get_by_name", return_value=return_value):
            got_usage = next(
                self.dbtcloud.yield_pipeline_usage(EXPECTED_JOB_DETAILS)
            ).right
            self.assertEqual(
                got_usage,
                PipelineUsage(
                    pipeline=return_value,
                    usage=UsageRequest(date=self.dbtcloud.today, count=2),
                ),
            )

        # Now check what happens if we already have some summary data for today
        return_value = Pipeline(
            id=uuid.uuid4(),
            name="pipeline_name",
            fullyQualifiedName="pipeline_service.pipeline_name",
            service=EntityReference(id=uuid.uuid4(), type="pipelineService"),
            tasks=[
                Task(
                    name="task1",
                    startDate=self.dbtcloud.today,
                    endDate="2025-02-19 11:09:36.920915+00:00",
                ),
                Task(
                    name="task2",
                    startDate="2025-02-19 11:08:24.326771+00:00",
                    endDate=self.dbtcloud.today,
                ),
                Task(
                    name="task3",
                    startDate="2025-02-19 11:08:24.326771+00:00",
                    endDate="2025-02-19 11:09:36.920915+00:00",
                ),
            ],
            usageSummary=UsageDetails(
                dailyStats=UsageStats(count=10), date=self.dbtcloud.today
            ),
        )
        with patch.object(OpenMetadata, "get_by_name", return_value=return_value):
            # Nothing is returned
            self.assertEqual(
                len(list(self.dbtcloud.yield_pipeline_usage(EXPECTED_JOB_DETAILS))), 0
            )

        # But if we have usage for today but the count is 0, we'll return the details
        return_value = Pipeline(
            id=uuid.uuid4(),
            name="pipeline_name",
            fullyQualifiedName="pipeline_service.pipeline_name",
            service=EntityReference(id=uuid.uuid4(), type="pipelineService"),
            tasks=[
                Task(
                    name="task1",
                    startDate=self.dbtcloud.today,
                    endDate="2025-02-19 11:09:36.920915+00:00",
                ),
                Task(
                    name="task2",
                    startDate="2025-02-19 11:08:24.326771+00:00",
                    endDate=self.dbtcloud.today,
                ),
                Task(
                    name="task3",
                    startDate="2025-02-19 11:08:24.326771+00:00",
                    endDate="2025-02-19 11:09:36.920915+00:00",
                ),
            ],
            usageSummary=UsageDetails(
                dailyStats=UsageStats(count=0), date=self.dbtcloud.today
            ),
        )
        with patch.object(OpenMetadata, "get_by_name", return_value=return_value):
            got_usage = next(
                self.dbtcloud.yield_pipeline_usage(EXPECTED_JOB_DETAILS)
            ).right
            self.assertEqual(
                next(self.dbtcloud.yield_pipeline_usage(EXPECTED_JOB_DETAILS)).right,
                PipelineUsage(
                    pipeline=return_value,
                    usage=UsageRequest(date=self.dbtcloud.today, count=2),
                ),
            )

        # But if we have usage for another day, then we do the difference
        return_value = Pipeline(
            id=uuid.uuid4(),
            name="pipeline_name",
            fullyQualifiedName="pipeline_service.pipeline_name",
            service=EntityReference(id=uuid.uuid4(), type="pipelineService"),
            tasks=[
                Task(
                    name="task1",
                    startDate=self.dbtcloud.today,
                    endDate="2025-02-19 11:09:36.920915+00:00",
                ),
                Task(
                    name="task2",
                    startDate="2025-02-19 11:08:24.326771+00:00",
                    endDate=self.dbtcloud.today,
                ),
                Task(
                    name="task3",
                    startDate="2025-02-19 11:08:24.326771+00:00",
                    endDate=self.dbtcloud.today,
                ),
                Task(
                    name="task4",
                    startDate="2025-02-19 11:08:24.326771+00:00",
                    endDate=self.dbtcloud.today,
                ),
                Task(
                    name="task5",
                    startDate="2025-02-19 11:08:24.326771+00:00",
                    endDate=self.dbtcloud.today,
                ),
                Task(
                    name="task6",
                    startDate="2025-02-19 11:08:24.326771+00:00",
                    endDate=self.dbtcloud.today,
                ),
                Task(
                    name="task7",
                    startDate="2025-02-19 11:08:24.326771+00:00",
                    endDate="2025-02-19 11:09:36.920915+00:00",
                ),
            ],
            usageSummary=UsageDetails(
                dailyStats=UsageStats(count=5),
                date=datetime.strftime(datetime.now() - timedelta(1), "%Y-%m-%d"),
            ),
        )
        with patch.object(OpenMetadata, "get_by_name", return_value=return_value):
            got_usage = next(
                self.dbtcloud.yield_pipeline_usage(EXPECTED_JOB_DETAILS)
            ).right
            self.assertEqual(
                next(self.dbtcloud.yield_pipeline_usage(EXPECTED_JOB_DETAILS)).right,
                PipelineUsage(
                    pipeline=return_value,
                    usage=UsageRequest(date=self.dbtcloud.today, count=1),
                ),
            )

        # If the past usage is higher than what we have today, something weird is going on
        # we don't return usage but don't explode
        return_value = Pipeline(
            id=uuid.uuid4(),
            name="pipeline_name",
            fullyQualifiedName="pipeline_service.pipeline_name",
            service=EntityReference(id=uuid.uuid4(), type="pipelineService"),
            tasks=[
                Task(
                    name="task1",
                    startDate=self.dbtcloud.today,
                    endDate="2025-02-19 11:09:36.920915+00:00",
                ),
                Task(
                    name="task2",
                    startDate="2025-02-19 11:08:24.326771+00:00",
                    endDate=self.dbtcloud.today,
                ),
                Task(
                    name="task3",
                    startDate="2025-02-19 11:08:24.326771+00:00",
                    endDate="2025-02-19 11:09:36.920915+00:00",
                ),
            ],
            usageSummary=UsageDetails(
                dailyStats=UsageStats(count=1000),
                date=datetime.strftime(datetime.now() - timedelta(1), "%Y-%m-%d"),
            ),
        )
        with patch.object(OpenMetadata, "get_by_name", return_value=return_value):
            self.assertEqual(
                len(list(self.dbtcloud.yield_pipeline_usage(EXPECTED_JOB_DETAILS))), 1
            )

            self.assertIsNotNone(
                list(self.dbtcloud.yield_pipeline_usage(EXPECTED_JOB_DETAILS))[0].left
            )

    def test_get_model_details(self):
        """
        Test getting model details from DBT Cloud
        """
        # Mock the graphql client's post method
        with patch.object(self.dbtcloud.client.graphql_client, "post") as mock_post:
            # Set up mock return value
            mock_post.return_value = {
                "data": {
                    "job": {
                        "models": [
                            {
                                "uniqueId": "model.dbt_test_new.model_32",
                                "name": "model_32",
                                "schema": "dbt_test_new",
                                "database": "dev",
                                "dependsOn": [
                                    "model.dbt_test_new.model_15",
                                    "model.dbt_test_new.model_11",
                                ],
                            },
                            {
                                "uniqueId": "model.dbt_test_new.model_15",
                                "name": "model_15",
                                "schema": "dbt_test_new",
                                "database": "dev",
                                "dependsOn": None,
                            },
                            {
                                "uniqueId": "model.dbt_test_new.model_11",
                                "name": "model_11",
                                "schema": "dbt_test_new",
                                "database": "dev",
                                "dependsOn": None,
                            },
                        ]
                    }
                }
            }

            # Call the method
            models = self.dbtcloud.client.get_model_details(
                70403103936332, 70403110257794
            )

            # Verify we got the expected models
            self.assertEqual(len(models), 3)

            # Verify the first model (model_32)
            model_32 = next(m for m in models if m.name == "model_32")
            self.assertEqual(model_32.database, "dev")
            self.assertEqual(model_32.dbtschema, "dbt_test_new")
            self.assertEqual(len(model_32.dependsOn), 2)
            self.assertIn("model.dbt_test_new.model_15", model_32.dependsOn)
            self.assertIn("model.dbt_test_new.model_11", model_32.dependsOn)

            # Test error case
            mock_post.side_effect = Exception("Test error")
            error_models = self.dbtcloud.client.get_model_details(
                70403103936332, 70403110257794
            )
            self.assertIsNone(error_models)

    def test_get_models_and_seeds_details(self):
        """
        Test getting models and seeds details from DBT Cloud
        """
        # Mock the graphql client's post method
        with patch.object(self.dbtcloud.client.graphql_client, "post") as mock_post:
            # Set up mock return value
            mock_post.return_value = {
                "data": {
                    "job": {
                        "models": [
                            {
                                "uniqueId": "model.dbt_test_new.model_32",
                                "name": "model_32",
                                "schema": "dbt_test_new",
                                "database": "dev",
                                "dependsOn": [
                                    "model.dbt_test_new.model_15",
                                    "model.dbt_test_new.model_11",
                                ],
                            },
                            {
                                "uniqueId": "model.dbt_test_new.model_15",
                                "name": "model_15",
                                "schema": "dbt_test_new",
                                "database": "dev",
                                "dependsOn": None,
                            },
                            {
                                "uniqueId": "model.dbt_test_new.model_11",
                                "name": "model_11",
                                "schema": "dbt_test_new",
                                "database": "dev",
                                "dependsOn": None,
                            },
                        ],
                        "seeds": [
                            {
                                "uniqueId": "seed.dbt_test_new.raw_payments",
                                "name": "raw_payments",
                                "schema": "dbt_test_new",
                                "database": "dev",
                            },
                            {
                                "uniqueId": "seed.dbt_test_new.raw_orders",
                                "name": "raw_orders",
                                "schema": "dbt_test_new",
                                "database": "dev",
                            },
                        ],
                    }
                }
            }

            # Call the method
            models_and_seeds = self.dbtcloud.client.get_models_and_seeds_details(
                70403103936332, 70403110257794
            )

            # Verify we got the expected models and seeds
            self.assertEqual(len(models_and_seeds), 5)

            # Verify the first model (model_32)
            model_32 = next(m for m in models_and_seeds if m.name == "model_32")
            self.assertEqual(model_32.database, "dev")
            self.assertEqual(model_32.dbtschema, "dbt_test_new")
            self.assertEqual(len(model_32.dependsOn), 2)
            self.assertIn("model.dbt_test_new.model_15", model_32.dependsOn)
            self.assertIn("model.dbt_test_new.model_11", model_32.dependsOn)

            # Verify seeds
            seeds = [m for m in models_and_seeds if m.uniqueId.startswith("seed.")]
            self.assertEqual(len(seeds), 2)
            self.assertIn("raw_payments", [s.name for s in seeds])
            self.assertIn("raw_orders", [s.name for s in seeds])

            # Test error case
            mock_post.side_effect = Exception("Test error")
            error_models = self.dbtcloud.client.get_models_and_seeds_details(
                70403103936332, 70403110257794
            )
            self.assertIsNone(error_models)

    def test_error_handling_in_lineage(self):
        """
        Test error handling in lineage generation
        """
        # Mock the context with latest run ID
        self.dbtcloud.context.get().__dict__["latest_run_id"] = 70403110257794

        # Mock metadata.get_by_name to raise an exception
        with patch.object(
            OpenMetadata, "get_by_name", side_effect=Exception("Test error")
        ):
            # Get the lineage details
            lineage_details = list(
                self.dbtcloud.yield_pipeline_lineage_details(EXPECTED_JOB_DETAILS)
            )

            # Verify we got an error
            self.assertEqual(len(lineage_details), 1)
            self.assertIsNotNone(lineage_details[0].left)
            self.assertIn("Test error", lineage_details[0].left.error)

    def test_yield_pipeline_lineage_details(self):
        """
        Test the lineage details generation from DBT Cloud models
        """
        # Mock the context with latest run ID
        self.dbtcloud.context.get().__dict__["latest_run_id"] = 70403110257794
        self.dbtcloud.context.get().__dict__["pipeline"] = "New job"
        self.dbtcloud.context.get().__dict__[
            "pipeline_service"
        ] = "dbtcloud_pipeline_test"

        # Mock the source config for lineage
        self.dbtcloud.source_config.lineageInformation = type(
            "obj", (object,), {"dbServiceNames": ["local_redshift"]}
        )

        # Create mock entities
        mock_pipeline = Pipeline(
            id=uuid.uuid4(),
            name="New job",
            fullyQualifiedName="dbtcloud_pipeline_test.New job",
            service=EntityReference(id=uuid.uuid4(), type="pipelineService"),
        )

        # Create source and target tables
        mock_source_table = Table(
            id=uuid.uuid4(),
            name="model_15",
            fullyQualifiedName="local_redshift.dev.dbt_test_new.model_15",
            database=EntityReference(id=uuid.uuid4(), type="database"),
            columns=[],
            databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
        )

        mock_target_table = Table(
            id=uuid.uuid4(),
            name="model_32",
            fullyQualifiedName="local_redshift.dev.dbt_test_new.model_32",
            database=EntityReference(id=uuid.uuid4(), type="database"),
            columns=[],
            databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
        )

        # Patch the metadata's get_by_name method
        with patch.object(self.dbtcloud.metadata, "get_by_name") as mock_get_by_name:

            def get_by_name_side_effect(entity, fqn):
                if entity == Pipeline:
                    # Handle both string FQN and FullyQualifiedEntityName
                    if isinstance(fqn, str):
                        if fqn == "dbtcloud_pipeline_test.New job":
                            return mock_pipeline
                    elif isinstance(fqn, FullyQualifiedEntityName):
                        if fqn.root == "dbtcloud_pipeline_test.New job":
                            return mock_pipeline
                elif entity == Table:
                    if "model_15" in fqn:
                        return mock_source_table
                    elif "model_32" in fqn:
                        return mock_target_table
                return "None data testing"

            mock_get_by_name.side_effect = get_by_name_side_effect

            # Mock the graphql client's post method
            with patch.object(
                self.dbtcloud.client, "get_models_and_seeds_details"
            ) as mock_get_parents, patch.object(
                self.dbtcloud.client, "get_model_details"
            ) as mock_get_models:

                mock_get_parents.return_value = [
                    DBTModel(
                        uniqueId="model.dbt_test_new.model_15",
                        name="model_15",
                        dbtschema="dbt_test_new",
                        database="dev",
                        dependsOn=None,
                    )
                ]

                mock_get_models.return_value = [
                    DBTModel(
                        uniqueId="model.dbt_test_new.model_32",
                        name="model_32",
                        dbtschema="dbt_test_new",
                        database="dev",
                        dependsOn=["model.dbt_test_new.model_15"],
                    )
                ]

                # Get the lineage details
                lineage_details = list(
                    self.dbtcloud.yield_pipeline_lineage_details(EXPECTED_JOB_DETAILS)
                )

                # Verify we got exactly one lineage edge
                self.assertEqual(len(lineage_details), 1)

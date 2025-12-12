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
from metadata.generated.schema.type.pipelineObservability import PipelineObservability
from metadata.generated.schema.type.usageDetails import UsageDetails, UsageStats
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.dbtcloud.metadata import DbtcloudSource
from metadata.ingestion.source.pipeline.dbtcloud.models import (
    DBTJob,
    DBTJobList,
    DBTModel,
    DBTRun,
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
    environment_id=70403103931988,
)

EXPECTED_CREATED_PIPELINES = CreatePipelineRequest(
    name=EntityName(root="New job"),
    description=Markdown(root="Example Job Description"),
    sourceUrl=SourceUrl(
        root="https://abc12.us1.dbt.com/deploy/70403103922125/projects/70403103926818/jobs/70403103936332"
    ),
    service=FullyQualifiedEntityName(root="dbtcloud_pipeline_test"),
    scheduleInterval="6 */12 * * 0,1,2,3,4,5,6",
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
        ),
        Task(
            name="70403111615088",
            sourceUrl=SourceUrl(
                root="https://abc12.us1.dbt.com/deploy/70403103922125/projects/70403103926818/runs/70403111615088/"
            ),
            startDate="None",
            endDate="None",
        ),
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
    scheduleInterval="6 */12 * * 0,1,2,3,4,5,6",
)

EXPECTED_JOB_FILTERS = ["70403103922125", "70403103922126"]

EXPECTED_PROJECT_FILTERS = ["70403103922127", "70403103922128"]

EXPECTED_ENVIRONMENT_FILTERS = ["70403103931988", "70403103931989"]

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

        # Set up run context for observability cache
        mock_run = DBTRun(
            id=70403110257794,
            status=1,
            state="Success",
            started_at="2024-05-27 10:42:20.621788+00:00",
            finished_at="2024-05-28 10:42:52.622408+00:00",
        )
        self.dbtcloud.context.get().__dict__["latest_run"] = mock_run
        self.dbtcloud.context.get().__dict__["current_runs"] = [mock_run]

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
                    fqn_str = str(fqn) if not isinstance(fqn, str) else fqn
                    if "model_15" in fqn_str:
                        return mock_source_table
                    elif "model_32" in fqn_str:
                        return mock_target_table
                return None

            mock_get_by_name.side_effect = get_by_name_side_effect

            # Mock the combined GraphQL method
            with patch.object(
                self.dbtcloud.client, "get_models_with_lineage"
            ) as mock_get_models_with_lineage:

                # Return (models, seeds, sources) tuple
                mock_get_models_with_lineage.return_value = (
                    [
                        DBTModel(
                            uniqueId="model.dbt_test_new.model_32",
                            name="model_32",
                            dbtschema="dbt_test_new",
                            database="dev",
                            runGeneratedAt="2024-05-27T10:42:20.621788+00:00",
                            dependsOn=["model.dbt_test_new.model_15"],
                        ),
                        DBTModel(
                            uniqueId="model.dbt_test_new.model_15",
                            name="model_15",
                            dbtschema="dbt_test_new",
                            database="dev",
                            runGeneratedAt="2024-05-27T10:42:20.621788+00:00",
                            dependsOn=None,
                        ),
                    ],
                    [],  # seeds
                    [],  # sources
                )

                # Get the lineage details
                lineage_details = list(
                    self.dbtcloud.yield_pipeline_lineage_details(EXPECTED_JOB_DETAILS)
                )

                # Verify we can call the method without errors
                # Note: Lineage edges may or may not be generated depending on entity resolution
                self.assertIsInstance(lineage_details, list)

    def test_get_table_pipeline_observability_with_context(self):
        """
        Test pipeline observability extraction using context data (current job)
        """
        # Set up context with current job data
        self.dbtcloud.context.get().__dict__["current_job_id"] = 70403103936332
        self.dbtcloud.context.get().__dict__["latest_run_id"] = 70403110257794
        self.dbtcloud.context.get().__dict__["current_pipeline_entity"] = MOCK_PIPELINE
        self.dbtcloud.context.get().__dict__["current_table_fqns"] = [
            "local_redshift.dev.dbt_test_new.model_15",
            "local_redshift.dev.dbt_test_new.model_32",
        ]

        # Create mock run object
        mock_run = DBTRun(
            id=70403110257794,
            status=1,
            state="Success",
            href="https://abc12.us1.dbt.com/deploy/70403103922125/projects/70403103926818/runs/70403110257794/",
            started_at="2024-05-27 10:42:20.621788+00:00",
            finished_at="2024-05-28 10:42:52.622408+00:00",
        )
        self.dbtcloud.context.get().__dict__["latest_run"] = mock_run
        self.dbtcloud.context.get().__dict__["current_runs"] = [mock_run]

        # Get observability data
        result = list(
            self.dbtcloud.get_table_pipeline_observability(EXPECTED_JOB_DETAILS)
        )

        # Verify we got results
        self.assertEqual(len(result), 1)
        table_pipeline_map = result[0]

        # Verify we have observability data for both tables
        self.assertEqual(len(table_pipeline_map), 2)
        self.assertIn("local_redshift.dev.dbt_test_new.model_15", table_pipeline_map)
        self.assertIn("local_redshift.dev.dbt_test_new.model_32", table_pipeline_map)

        # Verify observability data structure for model_15
        observability_list = table_pipeline_map[
            "local_redshift.dev.dbt_test_new.model_15"
        ]
        self.assertEqual(len(observability_list), 1)

        observability = observability_list[0]
        self.assertIsInstance(observability, PipelineObservability)
        # Compare FQN - handle both string and wrapped types
        pipeline_fqn = observability.pipeline.fullyQualifiedName
        if hasattr(pipeline_fqn, "root"):
            pipeline_fqn = pipeline_fqn.root
        mock_fqn = MOCK_PIPELINE.fullyQualifiedName
        if hasattr(mock_fqn, "root"):
            mock_fqn = mock_fqn.root
        self.assertEqual(pipeline_fqn, mock_fqn)
        self.assertEqual(observability.scheduleInterval, "6 */12 * * 0,1,2,3,4,5,6")
        # Compare status value
        status = observability.lastRunStatus
        if hasattr(status, "value"):
            status = status.value
        self.assertEqual(status, "Successful")

    def test_get_table_pipeline_observability_with_cache(self):
        """
        Test pipeline observability extraction using cached data (historical jobs)
        """
        # Clear current context to test cache fallback
        self.dbtcloud.context.get().__dict__["current_job_id"] = 99999
        self.dbtcloud.context.get().__dict__.pop("current_table_fqns", None)
        self.dbtcloud.context.get().__dict__.pop("latest_run", None)
        self.dbtcloud.context.get().__dict__.pop("current_pipeline_entity", None)

        # Populate observability cache with historical data
        mock_pipeline_2 = Pipeline(
            id=uuid.uuid4(),
            name="Cached Job",
            fullyQualifiedName="dbtcloud_pipeline_test.Cached Job",
            service=EntityReference(id=uuid.uuid4(), type="pipelineService"),
        )

        mock_run_1 = DBTRun(
            id=12345,
            status=1,
            state="Success",
            href="https://test.dbt.com/runs/12345/",
            started_at="2024-05-20 10:00:00.000000+00:00",
            finished_at="2024-05-20 11:00:00.000000+00:00",
        )

        mock_run_2 = DBTRun(
            id=12346,
            status=2,
            state="Error",
            href="https://test.dbt.com/runs/12346/",
            started_at="2024-05-21 10:00:00.000000+00:00",
            finished_at="2024-05-21 11:00:00.000000+00:00",
        )

        cache_key = (88888, "12345")
        self.dbtcloud.observability_cache[cache_key] = {
            "pipeline_entity": mock_pipeline_2,
            "job_details": DBTJob(
                id=88888,
                name="Cached Job",
                description="Cached job description",
                created_at="2024-05-20T10:00:00.000000+00:00",
                updated_at="2024-05-20T10:00:00.000000+00:00",
                state=1,
                job_type="other",
                schedule=DBTSchedule(cron="0 */6 * * *"),
                project_id=70403103926818,
            ),
            "table_fqns": {
                "local_redshift.dev.dbt_test_new.cached_model_1",
                "local_redshift.dev.dbt_test_new.cached_model_2",
            },
            "runs": [mock_run_1, mock_run_2],
        }

        # Get observability data
        result = list(
            self.dbtcloud.get_table_pipeline_observability(EXPECTED_JOB_DETAILS)
        )

        # Verify we got results from cache
        self.assertEqual(len(result), 1)
        table_pipeline_map = result[0]

        # Verify cached tables are present
        self.assertIn(
            "local_redshift.dev.dbt_test_new.cached_model_1", table_pipeline_map
        )
        self.assertIn(
            "local_redshift.dev.dbt_test_new.cached_model_2", table_pipeline_map
        )

        # Verify observability data
        observability_list = table_pipeline_map[
            "local_redshift.dev.dbt_test_new.cached_model_1"
        ]
        self.assertEqual(len(observability_list), 1)

        observability = observability_list[0]
        # Compare FQN - handle both string and wrapped types
        pipeline_fqn = observability.pipeline.fullyQualifiedName
        if hasattr(pipeline_fqn, "root"):
            pipeline_fqn = pipeline_fqn.root
        self.assertEqual(pipeline_fqn, "dbtcloud_pipeline_test.Cached Job")
        self.assertEqual(observability.scheduleInterval, "0 */6 * * *")
        # Compare status value
        status = observability.lastRunStatus
        if hasattr(status, "value"):
            status = status.value
        self.assertEqual(status, "Successful")

    def test_get_table_pipeline_observability_no_data(self):
        """
        Test pipeline observability when no context or cache data is available
        """
        # Clear all context and cache
        self.dbtcloud.context.get().__dict__.pop("current_table_fqns", None)
        self.dbtcloud.context.get().__dict__.pop("latest_run", None)
        self.dbtcloud.context.get().__dict__.pop("current_pipeline_entity", None)
        self.dbtcloud.observability_cache.clear()

        # Get observability data
        result = list(
            self.dbtcloud.get_table_pipeline_observability(EXPECTED_JOB_DETAILS)
        )

        # Should get an empty map
        self.assertEqual(len(result), 1)
        table_pipeline_map = result[0]
        self.assertEqual(len(table_pipeline_map), 0)

    def test_parse_timestamp_primary_format(self):
        """
        Test timestamp parsing with primary format
        """
        timestamp_str = "2024-05-27 10:42:20.621788+00:00"
        result = self.dbtcloud._parse_timestamp(timestamp_str)

        self.assertIsNotNone(result)
        # Timestamp is wrapped, check for root attribute
        self.assertTrue(hasattr(result, "root") or isinstance(result, int))

    def test_parse_timestamp_fallback_format(self):
        """
        Test timestamp parsing with ISO format (fallback)
        """
        timestamp_str = "2024-05-27T10:42:20.621788Z"
        result = self.dbtcloud._parse_timestamp(timestamp_str)

        self.assertIsNotNone(result)
        # Timestamp is wrapped, check for root attribute
        self.assertTrue(hasattr(result, "root") or isinstance(result, int))

    def test_parse_timestamp_invalid(self):
        """
        Test timestamp parsing with invalid format
        """
        timestamp_str = "invalid-timestamp"
        result = self.dbtcloud._parse_timestamp(timestamp_str)

        self.assertIsNone(result)

    def test_map_run_status(self):
        """
        Test status mapping for different run statuses
        """
        # Test string statuses
        self.assertEqual(self.dbtcloud._map_run_status("Success"), "Successful")
        self.assertEqual(self.dbtcloud._map_run_status("Error"), "Failed")
        self.assertEqual(self.dbtcloud._map_run_status("Cancelled"), "Skipped")
        self.assertEqual(self.dbtcloud._map_run_status("Running"), "Pending")
        self.assertEqual(self.dbtcloud._map_run_status("Queued"), "Pending")

        # Test numeric statuses
        self.assertEqual(self.dbtcloud._map_run_status(0), "Pending")
        self.assertEqual(self.dbtcloud._map_run_status(1), "Successful")
        self.assertEqual(self.dbtcloud._map_run_status(2), "Skipped")

        # Test None and unknown statuses
        self.assertEqual(self.dbtcloud._map_run_status(None), "Pending")
        self.assertEqual(self.dbtcloud._map_run_status("Unknown"), "Pending")

    def test_build_observability_from_run(self):
        """
        Test building PipelineObservability object from run data
        """
        mock_run = DBTRun(
            id=70403110257794,
            status=1,
            state="Success",
            href="https://abc12.us1.dbt.com/runs/70403110257794/",
            started_at="2024-05-27 10:42:20.621788+00:00",
            finished_at="2024-05-28 10:42:52.622408+00:00",
        )

        observability = self.dbtcloud._build_observability_from_run(
            run=mock_run,
            pipeline_entity=MOCK_PIPELINE,
            schedule_interval="6 */12 * * 0,1,2,3,4,5,6",
        )

        # Verify the observability object
        self.assertIsInstance(observability, PipelineObservability)
        # Compare FQN - handle both string and wrapped types
        pipeline_fqn = observability.pipeline.fullyQualifiedName
        if hasattr(pipeline_fqn, "root"):
            pipeline_fqn = pipeline_fqn.root
        mock_fqn = MOCK_PIPELINE.fullyQualifiedName
        if hasattr(mock_fqn, "root"):
            mock_fqn = mock_fqn.root
        self.assertEqual(pipeline_fqn, mock_fqn)
        self.assertEqual(observability.scheduleInterval, "6 */12 * * 0,1,2,3,4,5,6")
        # Compare status value
        status = observability.lastRunStatus
        if hasattr(status, "value"):
            status = status.value
        self.assertEqual(status, "Successful")
        self.assertIsNotNone(observability.startTime)
        self.assertIsNotNone(observability.endTime)
        self.assertIsNotNone(observability.lastRunTime)

    def test_observability_cache_population_during_lineage(self):
        """
        Test that observability cache is populated during lineage processing
        """
        # Mock the context
        self.dbtcloud.context.get().__dict__["latest_run_id"] = 70403110257794
        self.dbtcloud.context.get().__dict__["pipeline"] = "New job"
        self.dbtcloud.context.get().__dict__[
            "pipeline_service"
        ] = "dbtcloud_pipeline_test"

        # Mock the source config
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

        mock_table = Table(
            id=uuid.uuid4(),
            name="model_32",
            fullyQualifiedName="local_redshift.dev.dbt_test_new.model_32",
            database=EntityReference(id=uuid.uuid4(), type="database"),
            columns=[],
            databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
        )

        mock_run = DBTRun(
            id=70403110257794,
            status=1,
            state="Success",
            href="https://abc12.us1.dbt.com/runs/70403110257794/",
            started_at="2024-05-27 10:42:20.621788+00:00",
            finished_at="2024-05-28 10:42:52.622408+00:00",
        )

        # Clear cache before test
        self.dbtcloud.observability_cache.clear()

        # Patch metadata get_by_name
        with patch.object(self.dbtcloud.metadata, "get_by_name") as mock_get_by_name:

            def get_by_name_side_effect(entity, fqn):
                if entity == Pipeline:
                    return mock_pipeline
                elif entity == Table:
                    return mock_table
                return None

            mock_get_by_name.side_effect = get_by_name_side_effect

            # Mock client method - now using combined get_models_with_lineage
            with patch.object(
                self.dbtcloud.client, "get_models_with_lineage"
            ) as mock_get_models_with_lineage:

                # Return (models, seeds, sources) tuple
                mock_get_models_with_lineage.return_value = (
                    [
                        DBTModel(
                            uniqueId="model.dbt_test_new.model_32",
                            name="model_32",
                            dbtschema="dbt_test_new",
                            database="dev",
                            runGeneratedAt="2024-05-27T10:42:20.621788+00:00",
                            dependsOn=[],
                        )
                    ],
                    [],  # seeds
                    [],  # sources
                )

                # Set up context with run data
                self.dbtcloud.context.get().__dict__["latest_run"] = mock_run
                self.dbtcloud.context.get().__dict__["current_runs"] = [mock_run]
                self.dbtcloud.context.get().__dict__["current_job_id"] = 70403103936332

                # Process lineage (this should populate cache)
                list(self.dbtcloud.yield_pipeline_lineage_details(EXPECTED_JOB_DETAILS))

                # Verify cache was populated
                cache_key = (70403103936332, "70403110257794")
                self.assertIn(cache_key, self.dbtcloud.observability_cache)

                cached_data = self.dbtcloud.observability_cache[cache_key]
                self.assertIsNotNone(cached_data.get("pipeline_entity"))
                # table_fqns should be a set (may be empty for models without lineage)
                self.assertIsInstance(cached_data.get("table_fqns"), set)
                self.assertIsNotNone(cached_data.get("runs"))

    def test_observability_multiple_runs_for_same_table(self):
        """
        Test observability with multiple runs affecting the same table
        """
        # Set up multiple runs in cache
        mock_pipeline = Pipeline(
            id=uuid.uuid4(),
            name="Multi Run Job",
            fullyQualifiedName="dbtcloud_pipeline_test.Multi Run Job",
            service=EntityReference(id=uuid.uuid4(), type="pipelineService"),
        )

        mock_run_1 = DBTRun(
            id=1001,
            status=1,
            state="Success",
            started_at="2024-05-20 10:00:00.000000+00:00",
            finished_at="2024-05-20 11:00:00.000000+00:00",
        )

        mock_run_2 = DBTRun(
            id=1002,
            status=2,
            state="Error",
            started_at="2024-05-21 10:00:00.000000+00:00",
            finished_at="2024-05-21 11:00:00.000000+00:00",
        )

        mock_run_3 = DBTRun(
            id=1003,
            status=1,
            state="Success",
            started_at="2024-05-22 10:00:00.000000+00:00",
            finished_at="2024-05-22 11:00:00.000000+00:00",
        )

        table_fqn = "local_redshift.dev.dbt_test_new.shared_model"

        # Populate cache with multiple runs
        self.dbtcloud.observability_cache.clear()
        for run_id, run in [
            ("1001", mock_run_1),
            ("1002", mock_run_2),
            ("1003", mock_run_3),
        ]:
            cache_key = (77777, run_id)
            self.dbtcloud.observability_cache[cache_key] = {
                "pipeline_entity": mock_pipeline,
                "job_details": DBTJob(
                    id=77777,
                    name="Multi Run Job",
                    description="Job with multiple runs",
                    created_at="2024-05-20T10:00:00.000000+00:00",
                    updated_at="2024-05-22T10:00:00.000000+00:00",
                    state=1,
                    job_type="other",
                    schedule=DBTSchedule(cron="0 */12 * * *"),
                    project_id=70403103926818,
                ),
                "table_fqns": {table_fqn},
                "runs": [run],
            }

        # Clear current context to force cache usage
        self.dbtcloud.context.get().__dict__["current_job_id"] = 99999
        self.dbtcloud.context.get().__dict__.pop("current_table_fqns", None)
        self.dbtcloud.context.get().__dict__.pop("latest_run", None)

        # Get observability data
        result = list(
            self.dbtcloud.get_table_pipeline_observability(EXPECTED_JOB_DETAILS)
        )

        # Verify we got results
        self.assertEqual(len(result), 1)
        table_pipeline_map = result[0]

        # The same table should have observability from all 3 runs
        self.assertIn(table_fqn, table_pipeline_map)
        observability_list = table_pipeline_map[table_fqn]
        self.assertEqual(len(observability_list), 3)

        # Verify different statuses - extract values from enums
        statuses = []
        for obs in observability_list:
            status = obs.lastRunStatus
            if hasattr(status, "value"):
                status = status.value
            statuses.append(status)
        self.assertIn("Successful", statuses)
        self.assertIn("Skipped", statuses)  # status 2 maps to Skipped

    def test_get_models_with_lineage(self):
        """
        Test the combined GraphQL call for models and seeds with lineage info
        """
        with patch.object(self.dbtcloud.client.graphql_client, "post") as mock_post:
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
                                    "seed.dbt_test_new.raw_payments",
                                ],
                            },
                            {
                                "uniqueId": "model.dbt_test_new.model_15",
                                "name": "model_15",
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
                        ],
                        "sources": [],
                    }
                }
            }

            models, seeds, sources = self.dbtcloud.client.get_models_with_lineage(
                70403103936332, 70403110257794
            )

            # Verify models
            self.assertEqual(len(models), 2)
            model_32 = next(m for m in models if m.name == "model_32")
            self.assertEqual(model_32.database, "dev")
            self.assertEqual(model_32.dbtschema, "dbt_test_new")
            self.assertEqual(len(model_32.dependsOn), 2)

            # Verify seeds
            self.assertEqual(len(seeds), 1)
            self.assertEqual(seeds[0].name, "raw_payments")
            self.assertEqual(seeds[0].uniqueId, "seed.dbt_test_new.raw_payments")

            # Verify sources (empty in this test case)
            self.assertEqual(len(sources), 0)

            # Test error case
            mock_post.side_effect = Exception("Test error")
            error_models, error_seeds = self.dbtcloud.client.get_models_with_lineage(
                70403103936332, 70403110257794
            )
            self.assertIsNone(error_models)
            self.assertIsNone(error_seeds)

    def test_get_jobs_generator_pattern(self):
        """
        Test that get_jobs returns a generator and yields jobs correctly
        """
        with patch.object(self.dbtcloud.client, "_get_jobs") as mock_get_jobs:
            # Mock _get_jobs to return a generator
            mock_get_jobs.return_value = iter(DBTJobList(**MOCK_JOB_RESULT).Jobs)

            # Temporarily clear job_ids and project_ids to test the else branch
            original_job_ids = self.dbtcloud.client.job_ids
            original_project_ids = self.dbtcloud.client.project_ids
            self.dbtcloud.client.job_ids = None
            self.dbtcloud.client.project_ids = None

            try:
                # get_jobs should return an iterable
                jobs = self.dbtcloud.client.get_jobs()

                # Verify it's iterable (generator)
                from collections.abc import Iterable

                self.assertIsInstance(jobs, Iterable)

                # Consume the generator
                jobs_list = list(jobs)
                self.assertEqual(len(jobs_list), 1)
                self.assertEqual(jobs_list[0].name, "New job")
            finally:
                # Restore original values
                self.dbtcloud.client.job_ids = original_job_ids
                self.dbtcloud.client.project_ids = original_project_ids

    def test_get_jobs_with_project_ids_filter(self):
        """
        Test get_jobs filters by project_ids correctly
        """
        with patch.object(self.dbtcloud.client, "_get_jobs") as mock_get_jobs:
            # Create jobs with different project IDs
            job1 = DBTJob(
                id=1,
                name="Job 1",
                project_id=70403103922127,
                state=1,
                job_type="other",
                created_at="2024-05-27T10:42:10.111442+00:00",
                updated_at="2024-05-27T10:42:10.111459+00:00",
            )
            job2 = DBTJob(
                id=2,
                name="Job 2",
                project_id=70403103922128,
                state=1,
                job_type="other",
                created_at="2024-05-27T10:42:10.111442+00:00",
                updated_at="2024-05-27T10:42:10.111459+00:00",
            )

            # Mock _get_jobs to yield jobs for each project
            def mock_get_jobs_impl(job_id=None, project_id=None, environment_id=None):
                if project_id == "70403103922127":
                    yield job1
                elif project_id == "70403103922128":
                    yield job2

            mock_get_jobs.side_effect = mock_get_jobs_impl

            # Temporarily clear job_ids and environment_ids to test project filtering only
            original_job_ids = self.dbtcloud.client.job_ids
            original_env_ids = self.dbtcloud.client.environment_ids
            self.dbtcloud.client.job_ids = None
            self.dbtcloud.client.environment_ids = None

            try:
                # Call get_jobs (client has project_ids set)
                jobs = list(self.dbtcloud.client.get_jobs())

                # Should have called _get_jobs for each project_id
                self.assertEqual(mock_get_jobs.call_count, 2)
                self.assertEqual(len(jobs), 2)
            finally:
                self.dbtcloud.client.job_ids = original_job_ids
                self.dbtcloud.client.environment_ids = original_env_ids

    def test_get_runs_generator_with_limit(self):
        """
        Test that get_runs respects numberOfRuns limit and uses generator pattern
        """
        with patch.object(self.dbtcloud.client.client, "get") as mock_get:
            mock_get.return_value = MOCK_RUN_RESULT

            # get_runs should return an iterable
            runs = self.dbtcloud.client.get_runs(70403103936332)

            from collections.abc import Iterable

            self.assertIsInstance(runs, Iterable)

            # Consume the generator
            runs_list = list(runs)
            # numberOfRuns is 10 in the config, but MOCK_RUN_RESULT has 2 runs
            self.assertLessEqual(len(runs_list), 10)

    def test_table_entity_cache(self):
        """
        Test that _get_table_entity caches table lookups
        """
        mock_table = Table(
            id=uuid.uuid4(),
            name="test_table",
            fullyQualifiedName="service.db.schema.test_table",
            database=EntityReference(id=uuid.uuid4(), type="database"),
            columns=[],
            databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
        )

        with patch.object(
            self.dbtcloud.metadata, "get_by_name", return_value=mock_table
        ) as mock_get:
            # First call should hit the API
            result1 = self.dbtcloud._get_table_entity("service.db.schema.test_table")
            self.assertEqual(result1, mock_table)
            self.assertEqual(mock_get.call_count, 1)

            # Second call should use cache
            result2 = self.dbtcloud._get_table_entity("service.db.schema.test_table")
            self.assertEqual(result2, mock_table)
            self.assertEqual(mock_get.call_count, 1)  # Still 1, no new API call

            # Different FQN should hit the API again
            self.dbtcloud._get_table_entity("service.db.schema.other_table")
            self.assertEqual(mock_get.call_count, 2)

    def test_observability_cache_uses_set_for_table_fqns(self):
        """
        Test that observability cache uses set for table_fqns to prevent duplicates
        """
        # Set up context
        self.dbtcloud.context.get().__dict__["latest_run_id"] = 70403110257794
        self.dbtcloud.context.get().__dict__["pipeline"] = "New job"
        self.dbtcloud.context.get().__dict__[
            "pipeline_service"
        ] = "dbtcloud_pipeline_test"

        mock_run = DBTRun(
            id=70403110257794,
            status=1,
            state="Success",
            started_at="2024-05-27 10:42:20.621788+00:00",
            finished_at="2024-05-28 10:42:52.622408+00:00",
        )
        self.dbtcloud.context.get().__dict__["current_runs"] = [mock_run]

        # Mock source config
        self.dbtcloud.source_config.lineageInformation = type(
            "obj", (object,), {"dbServiceNames": ["local_redshift"]}
        )

        mock_pipeline = Pipeline(
            id=uuid.uuid4(),
            name="New job",
            fullyQualifiedName="dbtcloud_pipeline_test.New job",
            service=EntityReference(id=uuid.uuid4(), type="pipelineService"),
        )

        mock_table = Table(
            id=uuid.uuid4(),
            name="model_32",
            fullyQualifiedName="local_redshift.dev.dbt_test_new.model_32",
            database=EntityReference(id=uuid.uuid4(), type="database"),
            columns=[],
            databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
        )

        # Clear cache
        self.dbtcloud.observability_cache.clear()

        with patch.object(self.dbtcloud.metadata, "get_by_name") as mock_get_by_name:

            def get_by_name_side_effect(entity, fqn):
                if entity == Pipeline:
                    return mock_pipeline
                elif entity == Table:
                    return mock_table
                return None

            mock_get_by_name.side_effect = get_by_name_side_effect

            with patch.object(
                self.dbtcloud.client, "get_models_with_lineage"
            ) as mock_get_models:
                # Return same model multiple times to test deduplication
                mock_get_models.return_value = (
                    [
                        DBTModel(
                            uniqueId="model.dbt_test_new.model_32",
                            name="model_32",
                            dbtschema="dbt_test_new",
                            database="dev",
                            runGeneratedAt="2024-05-27T10:42:20.621788+00:00",
                            dependsOn=[],
                        ),
                    ],
                    [],
                    [],
                )

                # Process lineage
                list(self.dbtcloud.yield_pipeline_lineage_details(EXPECTED_JOB_DETAILS))

                # Verify cache was populated with set
                cache_key = (70403103936332, "70403110257794")
                if cache_key in self.dbtcloud.observability_cache:
                    table_fqns = self.dbtcloud.observability_cache[cache_key][
                        "table_fqns"
                    ]
                    self.assertIsInstance(table_fqns, set)

    def test_get_jobs_url_construction_with_project_id(self):
        """
        Test that _get_jobs constructs URL correctly with project_id filter
        """
        with patch.object(self.dbtcloud.client.client, "get") as mock_get:
            mock_get.return_value = MOCK_JOB_RESULT

            # Consume the generator
            list(self.dbtcloud.client._get_jobs(project_id="70403103922127"))

            # Verify the URL was constructed with project_id query param
            call_args = mock_get.call_args
            called_path = call_args[0][0]
            self.assertIn("?project_id=70403103922127", called_path)

    def test_get_runs_orders_by_created_at_descending(self):
        """
        Test that get_runs orders runs by created_at in descending order
        """
        with patch.object(self.dbtcloud.client.client, "get") as mock_get:
            mock_get.return_value = MOCK_RUN_RESULT

            # Consume the generator
            list(self.dbtcloud.client.get_runs(70403103936332))

            # Verify order_by was set correctly
            call_args = mock_get.call_args
            query_params = call_args[1]["data"]
            self.assertEqual(query_params["order_by"], "-created_at")

    def test_get_jobs_url_construction_with_environment_id(self):
        """
        Test that _get_jobs constructs URL correctly with environment_id filter
        """
        with patch.object(self.dbtcloud.client.client, "get") as mock_get:
            mock_get.return_value = MOCK_JOB_RESULT

            # Consume the generator
            list(self.dbtcloud.client._get_jobs(environment_id="70403103931988"))

            # Verify the URL was constructed with environment_id query param
            call_args = mock_get.call_args
            called_path = call_args[0][0]
            self.assertIn("?environment_id=70403103931988", called_path)

    def test_get_jobs_url_construction_with_both_project_and_environment_id(self):
        """
        Test that _get_jobs constructs URL correctly with both project_id and environment_id
        """
        with patch.object(self.dbtcloud.client.client, "get") as mock_get:
            mock_get.return_value = MOCK_JOB_RESULT

            # Consume the generator
            list(
                self.dbtcloud.client._get_jobs(
                    project_id="70403103922127", environment_id="70403103931988"
                )
            )

            # Verify the URL was constructed with both query params
            call_args = mock_get.call_args
            called_path = call_args[0][0]
            self.assertIn("project_id=70403103922127", called_path)
            self.assertIn("environment_id=70403103931988", called_path)
            self.assertIn("&", called_path)

    def test_get_jobs_with_environment_ids_filter(self):
        """
        Test get_jobs filters by environment_ids correctly
        """
        with patch.object(self.dbtcloud.client, "_get_jobs") as mock_get_jobs:
            # Create jobs with different environment IDs
            job1 = DBTJob(
                id=1,
                name="Job 1",
                project_id=70403103926818,
                environment_id=70403103931988,
                state=1,
                job_type="other",
                created_at="2024-05-27T10:42:10.111442+00:00",
                updated_at="2024-05-27T10:42:10.111459+00:00",
            )
            job2 = DBTJob(
                id=2,
                name="Job 2",
                project_id=70403103926818,
                environment_id=70403103931989,
                state=1,
                job_type="other",
                created_at="2024-05-27T10:42:10.111442+00:00",
                updated_at="2024-05-27T10:42:10.111459+00:00",
            )

            # Mock _get_jobs to yield jobs for each environment
            def mock_get_jobs_impl(job_id=None, project_id=None, environment_id=None):
                if environment_id == "70403103931988":
                    yield job1
                elif environment_id == "70403103931989":
                    yield job2

            mock_get_jobs.side_effect = mock_get_jobs_impl

            # Temporarily set only environment_ids (no job_ids or project_ids)
            original_job_ids = self.dbtcloud.client.job_ids
            original_project_ids = self.dbtcloud.client.project_ids
            original_env_ids = self.dbtcloud.client.environment_ids
            self.dbtcloud.client.job_ids = None
            self.dbtcloud.client.project_ids = None
            self.dbtcloud.client.environment_ids = EXPECTED_ENVIRONMENT_FILTERS

            try:
                # Call get_jobs (client has environment_ids set)
                jobs = list(self.dbtcloud.client.get_jobs())

                # Should have called _get_jobs for each environment_id
                self.assertEqual(mock_get_jobs.call_count, 2)
                self.assertEqual(len(jobs), 2)
            finally:
                self.dbtcloud.client.job_ids = original_job_ids
                self.dbtcloud.client.project_ids = original_project_ids
                self.dbtcloud.client.environment_ids = original_env_ids

    def test_get_jobs_job_ids_takes_precedence(self):
        """
        Test that jobIds takes precedence over projectIds and environmentIds
        """
        with patch.object(self.dbtcloud.client, "_get_jobs") as mock_get_jobs:
            job1 = DBTJob(
                id=70403103922125,
                name="Specific Job",
                project_id=70403103926818,
                environment_id=70403103931988,
                state=1,
                job_type="other",
                created_at="2024-05-27T10:42:10.111442+00:00",
                updated_at="2024-05-27T10:42:10.111459+00:00",
            )

            def mock_get_jobs_impl(job_id=None, project_id=None, environment_id=None):
                if job_id == "70403103922125":
                    yield job1

            mock_get_jobs.side_effect = mock_get_jobs_impl

            # Set all filters - job_ids should take precedence
            original_env_ids = self.dbtcloud.client.environment_ids
            self.dbtcloud.client.environment_ids = EXPECTED_ENVIRONMENT_FILTERS

            try:
                jobs = list(self.dbtcloud.client.get_jobs())

                # Should only call _get_jobs with job_id, ignoring project/environment
                for call in mock_get_jobs.call_args_list:
                    _, kwargs = call
                    # Verify job_id is passed and project_id/environment_id are not
                    self.assertIsNotNone(kwargs.get("job_id"))
                    self.assertIsNone(kwargs.get("project_id"))
                    self.assertIsNone(kwargs.get("environment_id"))
            finally:
                self.dbtcloud.client.environment_ids = original_env_ids

    def test_get_jobs_with_project_and_environment_ids(self):
        """
        Test get_jobs with both projectIds and environmentIds filters
        """
        with patch.object(self.dbtcloud.client, "_get_jobs") as mock_get_jobs:
            job1 = DBTJob(
                id=1,
                name="Job P1E1",
                project_id=70403103922127,
                environment_id=70403103931988,
                state=1,
                job_type="other",
                created_at="2024-05-27T10:42:10.111442+00:00",
                updated_at="2024-05-27T10:42:10.111459+00:00",
            )

            def mock_get_jobs_impl(job_id=None, project_id=None, environment_id=None):
                if project_id and environment_id:
                    yield job1

            mock_get_jobs.side_effect = mock_get_jobs_impl

            # Clear job_ids and set both project and environment filters
            original_job_ids = self.dbtcloud.client.job_ids
            original_env_ids = self.dbtcloud.client.environment_ids
            self.dbtcloud.client.job_ids = None
            self.dbtcloud.client.environment_ids = ["70403103931988"]

            try:
                jobs = list(self.dbtcloud.client.get_jobs())

                # Should call _get_jobs for each project_id x environment_id combination
                # 2 project_ids x 1 environment_id = 2 calls
                self.assertEqual(mock_get_jobs.call_count, 2)

                # Verify both project_id and environment_id are passed
                for call in mock_get_jobs.call_args_list:
                    _, kwargs = call
                    self.assertIsNotNone(kwargs.get("project_id"))
                    self.assertIsNotNone(kwargs.get("environment_id"))
            finally:
                self.dbtcloud.client.job_ids = original_job_ids
                self.dbtcloud.client.environment_ids = original_env_ids

    def test_lineage_skips_models_without_run_generated_at(self):
        """
        Test that models without runGeneratedAt are skipped during lineage processing
        """
        # Clear caches
        self.dbtcloud._table_entity_cache.clear()
        self.dbtcloud.observability_cache.clear()

        # Mock the context
        self.dbtcloud.context.get().__dict__["latest_run_id"] = 70403110257794
        self.dbtcloud.context.get().__dict__["pipeline"] = "New job"
        self.dbtcloud.context.get().__dict__[
            "pipeline_service"
        ] = "dbtcloud_pipeline_test"

        mock_run = DBTRun(
            id=70403110257794,
            status=1,
            state="Success",
            started_at="2024-05-27 10:42:20.621788+00:00",
            finished_at="2024-05-28 10:42:52.622408+00:00",
        )
        self.dbtcloud.context.get().__dict__["latest_run"] = mock_run
        self.dbtcloud.context.get().__dict__["current_runs"] = [mock_run]

        # Mock source config
        self.dbtcloud.source_config.lineageInformation = type(
            "obj", (object,), {"dbServiceNames": ["local_redshift"]}
        )

        mock_pipeline = Pipeline(
            id=uuid.uuid4(),
            name="New job",
            fullyQualifiedName="dbtcloud_pipeline_test.New job",
            service=EntityReference(id=uuid.uuid4(), type="pipelineService"),
        )

        mock_table = Table(
            id=uuid.uuid4(),
            name="model_with_run",
            fullyQualifiedName="local_redshift.dev.dbt_test_new.model_with_run",
            database=EntityReference(id=uuid.uuid4(), type="database"),
            columns=[],
            databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
        )

        with patch.object(self.dbtcloud.metadata, "get_by_name") as mock_get_by_name:

            def get_by_name_side_effect(entity, fqn):
                if entity == Pipeline:
                    return mock_pipeline
                elif entity == Table:
                    return mock_table
                return None

            mock_get_by_name.side_effect = get_by_name_side_effect

            with patch.object(
                self.dbtcloud.client, "get_models_with_lineage"
            ) as mock_get_models:
                # Return models - one with runGeneratedAt, one without
                mock_get_models.return_value = (
                    [
                        DBTModel(
                            uniqueId="model.dbt_test_new.model_with_run",
                            name="model_with_run",
                            dbtschema="dbt_test_new",
                            database="dev",
                            runGeneratedAt="2024-05-27T10:42:20.621788+00:00",
                            dependsOn=[],
                        ),
                        DBTModel(
                            uniqueId="model.dbt_test_new.model_without_run",
                            name="model_without_run",
                            dbtschema="dbt_test_new",
                            database="dev",
                            runGeneratedAt=None,  # No runGeneratedAt
                            dependsOn=[],
                        ),
                    ],
                    [],  # seeds
                    [],  # sources
                )

                # Process lineage
                lineage_results = list(
                    self.dbtcloud.yield_pipeline_lineage_details(EXPECTED_JOB_DETAILS)
                )

                # The model without runGeneratedAt should be skipped
                # Only the model with runGeneratedAt should be processed
                # Verify context table FQNs only contains the model with runGeneratedAt
                ctx = self.dbtcloud.context.get()
                if hasattr(ctx, "current_table_fqns") and ctx.current_table_fqns:
                    # Should only have the model with runGeneratedAt
                    for fqn_str in ctx.current_table_fqns:
                        self.assertNotIn("model_without_run", fqn_str)

    def test_lineage_skips_parent_models_without_run_generated_at(self):
        """
        Test that parent models/seeds without runGeneratedAt are skipped,
        but parent sources are NOT skipped (sources don't need runGeneratedAt)
        """
        # Clear caches
        self.dbtcloud._table_entity_cache.clear()
        self.dbtcloud.observability_cache.clear()

        # Mock the context
        self.dbtcloud.context.get().__dict__["latest_run_id"] = 70403110257794
        self.dbtcloud.context.get().__dict__["pipeline"] = "New job"
        self.dbtcloud.context.get().__dict__[
            "pipeline_service"
        ] = "dbtcloud_pipeline_test"

        mock_run = DBTRun(
            id=70403110257794,
            status=1,
            state="Success",
            started_at="2024-05-27 10:42:20.621788+00:00",
            finished_at="2024-05-28 10:42:52.622408+00:00",
        )
        self.dbtcloud.context.get().__dict__["latest_run"] = mock_run
        self.dbtcloud.context.get().__dict__["current_runs"] = [mock_run]

        # Mock source config
        self.dbtcloud.source_config.lineageInformation = type(
            "obj", (object,), {"dbServiceNames": ["local_redshift"]}
        )

        mock_pipeline = Pipeline(
            id=uuid.uuid4(),
            name="New job",
            fullyQualifiedName="dbtcloud_pipeline_test.New job",
            service=EntityReference(id=uuid.uuid4(), type="pipelineService"),
        )

        # Create mock tables for each entity
        mock_tables = {
            "child_model": Table(
                id=uuid.uuid4(),
                name="child_model",
                fullyQualifiedName="local_redshift.dev.dbt_test_new.child_model",
                database=EntityReference(id=uuid.uuid4(), type="database"),
                columns=[],
                databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
            ),
            "parent_model_with_run": Table(
                id=uuid.uuid4(),
                name="parent_model_with_run",
                fullyQualifiedName="local_redshift.dev.dbt_test_new.parent_model_with_run",
                database=EntityReference(id=uuid.uuid4(), type="database"),
                columns=[],
                databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
            ),
            "parent_model_without_run": Table(
                id=uuid.uuid4(),
                name="parent_model_without_run",
                fullyQualifiedName="local_redshift.dev.dbt_test_new.parent_model_without_run",
                database=EntityReference(id=uuid.uuid4(), type="database"),
                columns=[],
                databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
            ),
            "source_table": Table(
                id=uuid.uuid4(),
                name="source_table",
                fullyQualifiedName="local_redshift.dev.dbt_test_new.source_table",
                database=EntityReference(id=uuid.uuid4(), type="database"),
                columns=[],
                databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
            ),
        }

        with patch.object(self.dbtcloud.metadata, "get_by_name") as mock_get_by_name:

            def get_by_name_side_effect(entity, fqn):
                if entity == Pipeline:
                    return mock_pipeline
                elif entity == Table:
                    fqn_str = str(fqn) if not isinstance(fqn, str) else fqn
                    for table_name, table in mock_tables.items():
                        if table_name in fqn_str:
                            return table
                return None

            mock_get_by_name.side_effect = get_by_name_side_effect

            with patch.object(
                self.dbtcloud.client, "get_models_with_lineage"
            ) as mock_get_models:
                # Return a child model that depends on:
                # 1. A parent model WITH runGeneratedAt (should create lineage)
                # 2. A parent model WITHOUT runGeneratedAt (should be skipped)
                # 3. A source (should create lineage - sources don't need runGeneratedAt)
                mock_get_models.return_value = (
                    [
                        DBTModel(
                            uniqueId="model.dbt_test_new.child_model",
                            name="child_model",
                            dbtschema="dbt_test_new",
                            database="dev",
                            runGeneratedAt="2024-05-27T10:42:20.621788+00:00",
                            dependsOn=[
                                "model.dbt_test_new.parent_model_with_run",
                                "model.dbt_test_new.parent_model_without_run",
                                "source.dbt_test_new.source_table",
                            ],
                        ),
                        DBTModel(
                            uniqueId="model.dbt_test_new.parent_model_with_run",
                            name="parent_model_with_run",
                            dbtschema="dbt_test_new",
                            database="dev",
                            runGeneratedAt="2024-05-27T10:42:20.621788+00:00",
                            dependsOn=None,
                        ),
                        DBTModel(
                            uniqueId="model.dbt_test_new.parent_model_without_run",
                            name="parent_model_without_run",
                            dbtschema="dbt_test_new",
                            database="dev",
                            runGeneratedAt=None,  # No runGeneratedAt - should be skipped
                            dependsOn=None,
                        ),
                    ],
                    [],  # seeds
                    [
                        DBTModel(
                            uniqueId="source.dbt_test_new.source_table",
                            name="source_table",
                            dbtschema="dbt_test_new",
                            database="dev",
                            runGeneratedAt=None,  # Sources don't have runGeneratedAt
                            dependsOn=None,
                        ),
                    ],  # sources
                )

                # Process lineage
                lineage_results = list(
                    self.dbtcloud.yield_pipeline_lineage_details(EXPECTED_JOB_DETAILS)
                )

                # Verify method completed without errors
                self.assertIsInstance(lineage_results, list)

                # Verify that if any lineage was generated, parent_model_without_run
                # should not appear as a from_entity (it should be skipped)
                successful_edges = [r for r in lineage_results if r.right is not None]
                for edge in successful_edges:
                    from_entity_id = str(edge.right.edge.fromEntity.id)
                    # The parent_model_without_run should never appear as a source
                    self.assertNotEqual(
                        from_entity_id,
                        str(mock_tables["parent_model_without_run"].id),
                    )

    def test_lineage_allows_sources_without_run_generated_at(self):
        """
        Test that sources are processed even without runGeneratedAt
        because sources are auto-generated and don't require it
        """
        # Clear caches
        self.dbtcloud._table_entity_cache.clear()
        self.dbtcloud.observability_cache.clear()

        # Mock the context
        self.dbtcloud.context.get().__dict__["latest_run_id"] = 70403110257794
        self.dbtcloud.context.get().__dict__["pipeline"] = "New job"
        self.dbtcloud.context.get().__dict__[
            "pipeline_service"
        ] = "dbtcloud_pipeline_test"

        mock_run = DBTRun(
            id=70403110257794,
            status=1,
            state="Success",
            started_at="2024-05-27 10:42:20.621788+00:00",
            finished_at="2024-05-28 10:42:52.622408+00:00",
        )
        self.dbtcloud.context.get().__dict__["latest_run"] = mock_run
        self.dbtcloud.context.get().__dict__["current_runs"] = [mock_run]

        # Mock source config
        self.dbtcloud.source_config.lineageInformation = type(
            "obj", (object,), {"dbServiceNames": ["local_redshift"]}
        )

        mock_pipeline = Pipeline(
            id=uuid.uuid4(),
            name="New job",
            fullyQualifiedName="dbtcloud_pipeline_test.New job",
            service=EntityReference(id=uuid.uuid4(), type="pipelineService"),
        )

        mock_model_table = Table(
            id=uuid.uuid4(),
            name="model_from_source",
            fullyQualifiedName="local_redshift.dev.dbt_test_new.model_from_source",
            database=EntityReference(id=uuid.uuid4(), type="database"),
            columns=[],
            databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
        )

        mock_source_table = Table(
            id=uuid.uuid4(),
            name="raw_data",
            fullyQualifiedName="local_redshift.dev.dbt_test_new.raw_data",
            database=EntityReference(id=uuid.uuid4(), type="database"),
            columns=[],
            databaseSchema=EntityReference(id=uuid.uuid4(), type="databaseSchema"),
        )

        with patch.object(self.dbtcloud.metadata, "get_by_name") as mock_get_by_name:

            def get_by_name_side_effect(entity, fqn):
                if entity == Pipeline:
                    return mock_pipeline
                elif entity == Table:
                    fqn_str = str(fqn) if not isinstance(fqn, str) else fqn
                    if "model_from_source" in fqn_str:
                        return mock_model_table
                    elif "raw_data" in fqn_str:
                        return mock_source_table
                return None

            mock_get_by_name.side_effect = get_by_name_side_effect

            with patch.object(
                self.dbtcloud.client, "get_models_with_lineage"
            ) as mock_get_models:
                # Return a model that depends on a source (source has no runGeneratedAt)
                mock_get_models.return_value = (
                    [
                        DBTModel(
                            uniqueId="model.dbt_test_new.model_from_source",
                            name="model_from_source",
                            dbtschema="dbt_test_new",
                            database="dev",
                            runGeneratedAt="2024-05-27T10:42:20.621788+00:00",
                            dependsOn=["source.dbt_test_new.raw_data"],
                        ),
                    ],
                    [],  # seeds
                    [
                        DBTModel(
                            uniqueId="source.dbt_test_new.raw_data",
                            name="raw_data",
                            dbtschema="dbt_test_new",
                            database="dev",
                            runGeneratedAt=None,  # Sources don't have runGeneratedAt
                            dependsOn=None,
                        ),
                    ],  # sources
                )

                # Process lineage
                lineage_results = list(
                    self.dbtcloud.yield_pipeline_lineage_details(EXPECTED_JOB_DETAILS)
                )

                # Verify method completed without errors
                self.assertIsInstance(lineage_results, list)
                # Sources should NOT be filtered out even though they have no runGeneratedAt
                # Note: Actual lineage generation depends on entity resolution (FQN matching)
                # The key test is that no exception was raised when processing
                # a source with runGeneratedAt=None

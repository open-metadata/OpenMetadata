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
Client to interact with databricks apis
"""
import json
import traceback
from datetime import timedelta
from typing import Iterable, List

import requests

from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.ingestion.ometa.client import APIError
from metadata.utils.constants import QUERY_WITH_DBT, QUERY_WITH_OM_VERSION
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()
API_TIMEOUT = 10
PAGE_SIZE = 100
QUERIES_PATH = "/sql/history/queries"

MOCK = True


class DatabricksClientException(Exception):
    """
    Class to throw auth and other databricks api exceptions.
    """


class DatabricksClient:
    """
    DatabricksClient creates a Databricks connection based on DatabricksCredentials.
    """

    def __init__(self, config: DatabricksConnection):
        self.config = config
        base_url, *_ = self.config.hostPort.split(":")
        api_version = "/api/2.0"
        job_api_version = "/api/2.1"
        auth_token = self.config.token.get_secret_value()
        self.base_url = f"https://{base_url}{api_version}"
        self.base_query_url = f"{self.base_url}{QUERIES_PATH}"
        self.base_job_url = f"https://{base_url}{job_api_version}/jobs"
        self.jobs_list_url = f"{self.base_job_url}/list"
        self.jobs_run_list_url = f"{self.base_job_url}/runs/list"
        self.headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json",
        }
        self.client = requests

    def test_query_api_access(self) -> None:
        res = self.client.get(
            self.base_query_url, headers=self.headers, timeout=API_TIMEOUT
        )
        if res.status_code != 200:
            raise APIError(res.json)

    def _run_query_paginator(self, data, result, end_time, response):
        while True:
            if response:
                next_page_token = response.get("next_page_token", None)
                has_next_page = response.get("has_next_page", None)
                if next_page_token:
                    data["page_token"] = next_page_token
                if not has_next_page:
                    data = {}
                    break
            else:
                break

            if result[-1]["execution_end_time_ms"] <= end_time:
                response = self.client.get(
                    self.base_query_url,
                    data=json.dumps(data),
                    headers=self.headers,
                    timeout=API_TIMEOUT,
                ).json()
                yield from response.get("res") or []

    def list_query_history(self, start_date=None, end_date=None) -> List[dict]:
        """
        Method returns List the history of queries through SQL warehouses
        """
        try:
            data = {}
            daydiff = end_date - start_date

            for days in range(daydiff.days):
                start_time = (start_date + timedelta(days=days),)
                end_time = (start_date + timedelta(days=days + 1),)

                start_time = datetime_to_ts(start_time[0])
                end_time = datetime_to_ts(end_time[0])

                if not data:
                    if start_time and end_time:
                        data["filter_by"] = {
                            "query_start_time_range": {
                                "start_time_ms": start_time,
                                "end_time_ms": end_time,
                            }
                        }

                    response = self.client.get(
                        self.base_query_url,
                        data=json.dumps(data),
                        headers=self.headers,
                        timeout=API_TIMEOUT,
                    ).json()

                    result = response.get("res") or []
                    data = {}

                yield from result
                yield from self._run_query_paginator(
                    data=data, result=result, end_time=end_time, response=response
                ) or []

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(exc)

    def is_query_valid(self, row) -> bool:
        query_text = row.get("query_text")
        return not (
            query_text.startswith(QUERY_WITH_DBT)
            or query_text.startswith(QUERY_WITH_OM_VERSION)
        )

    def list_jobs_test_connection(self) -> None:
        data = {"limit": 1, "expand_tasks": True, "offset": 0}
        response = self.client.get(
            self.jobs_list_url,
            data=json.dumps(data),
            headers=self.headers,
            timeout=API_TIMEOUT,
        )
        if response.status_code != 200:
            raise DatabricksClientException(response.text)

    def _get_mock_jobs_data(self) -> dict:
        """
        Returns mock data for jobs list
        """
        return {
            "has_more": False,
            "jobs": [
                {
                    "created_time": 1601370337343,
                    "creator_user_name": "user.name@databricks.com",
                    "job_id": 11223344,
                    "settings": {
                        "continuous": {"pause_status": "UNPAUSED"},
                        "deployment": {
                            "kind": "BUNDLE",
                            "metadata_file_path": "string",
                        },
                        "description": "This job contain multiple tasks that are required to produce the weekly shark sightings report.",
                        "edit_mode": "UI_LOCKED",
                        "email_notifications": {
                            "no_alert_for_skipped_runs": False,
                            "on_duration_warning_threshold_exceeded": [
                                "user.name@databricks.com"
                            ],
                            "on_failure": ["user.name@databricks.com"],
                            "on_start": ["user.name@databricks.com"],
                            "on_streaming_backlog_exceeded": [
                                "user.name@databricks.com"
                            ],
                            "on_success": ["user.name@databricks.com"],
                        },
                        "environments": [
                            {
                                "environment_key": "string",
                                "spec": {
                                    "client": "1",
                                    "dependencies": [
                                        "foo==0.0.1",
                                        "-r /Workspace/test/requirements.txt",
                                    ],
                                    "environment_version": "1",
                                },
                            }
                        ],
                        "format": "SINGLE_TASK",
                        "git_source": {
                            "git_branch": "main",
                            "git_provider": "gitHub",
                            "git_url": "https://github.com/databricks/databricks-cli",
                        },
                        "health": {
                            "rules": [
                                {
                                    "metric": "RUN_DURATION_SECONDS",
                                    "op": "GREATER_THAN",
                                    "value": 10,
                                }
                            ]
                        },
                        "job_clusters": [
                            {
                                "job_cluster_key": "auto_scaling_cluster",
                                "new_cluster": {
                                    "autoscale": {"max_workers": 16, "min_workers": 2},
                                    "node_type_id": None,
                                    "spark_conf": {"spark.speculation": True},
                                    "spark_version": "7.3.x-scala2.12",
                                },
                            }
                        ],
                        "max_concurrent_runs": 10,
                        "name": "A multitask job",
                        "notification_settings": {
                            "alert_on_last_attempt": False,
                            "no_alert_for_canceled_runs": False,
                            "no_alert_for_skipped_runs": False,
                        },
                        "parameters": [{"default": "users", "name": "table"}],
                        "performance_target": "PERFORMANCE_TARGET_UNSPECIFIED",
                        "queue": {"enabled": True},
                        "run_as": {
                            "service_principal_name": "692bc6d0-ffa3-11ed-be56-0242ac120002",
                            "user_name": "user@databricks.com",
                        },
                        "schedule": {
                            "pause_status": "UNPAUSED",
                            "quartz_cron_expression": "20 30 * * * ?",
                            "timezone_id": "Europe/London",
                        },
                        "tags": {"cost-center": "engineering", "team": "jobs"},
                        "tasks": [
                            {
                                "depends_on": [],
                                "description": "Extracts session data from events",
                                "existing_cluster_id": "0923-164208-meows279",
                                "libraries": [
                                    {"jar": "dbfs:/mnt/databricks/Sessionize.jar"}
                                ],
                                "max_retries": 3,
                                "min_retry_interval_millis": 2000,
                                "retry_on_timeout": False,
                                "spark_jar_task": {
                                    "main_class_name": "com.databricks.Sessionize",
                                    "parameters": ["--data", "dbfs:/path/to/data.json"],
                                },
                                "task_key": "Sessionize",
                                "timeout_seconds": 86400,
                            },
                            {
                                "depends_on": [],
                                "description": "Ingests order data",
                                "job_cluster_key": "auto_scaling_cluster",
                                "libraries": [
                                    {"jar": "dbfs:/mnt/databricks/OrderIngest.jar"}
                                ],
                                "max_retries": 3,
                                "min_retry_interval_millis": 2000,
                                "retry_on_timeout": False,
                                "spark_jar_task": {
                                    "main_class_name": "com.databricks.OrdersIngest",
                                    "parameters": [
                                        "--data",
                                        "dbfs:/path/to/order-data.json",
                                    ],
                                },
                                "task_key": "Orders_Ingest",
                                "timeout_seconds": 86400,
                            },
                            {
                                "depends_on": [
                                    {"task_key": "Orders_Ingest"},
                                    {"task_key": "Sessionize"},
                                ],
                                "description": "Matches orders with user sessions",
                                "max_retries": 3,
                                "min_retry_interval_millis": 2000,
                                "new_cluster": {
                                    "autoscale": {"max_workers": 16, "min_workers": 2},
                                    "node_type_id": None,
                                    "spark_conf": {"spark.speculation": True},
                                    "spark_version": "7.3.x-scala2.12",
                                },
                                "notebook_task": {
                                    "base_parameters": {
                                        "age": "35",
                                        "name": "John Doe",
                                    },
                                    "notebook_path": "/Users/user.name@databricks.com/Match",
                                },
                                "retry_on_timeout": False,
                                "run_if": "ALL_SUCCESS",
                                "task_key": "Match",
                                "timeout_seconds": 86400,
                            },
                        ],
                        "timeout_seconds": 86400,
                        "trigger": {
                            "file_arrival": {
                                "min_time_between_triggers_seconds": 0,
                                "url": "string",
                                "wait_after_last_change_seconds": 0,
                            },
                            "pause_status": "UNPAUSED",
                            "periodic": {
                                "interval": 0,
                                "unit": "TIME_UNIT_UNSPECIFIED",
                            },
                        },
                        "webhook_notifications": {
                            "on_duration_warning_threshold_exceeded": [
                                [{"id": "0481e838-0a59-4eff-9541-a4ca6f149574"}]
                            ],
                            "on_failure": [
                                [{"id": "0481e838-0a59-4eff-9541-a4ca6f149574"}]
                            ],
                            "on_start": [
                                [{"id": "0481e838-0a59-4eff-9541-a4ca6f149574"}]
                            ],
                            "on_streaming_backlog_exceeded": [
                                [{"id": "0481e838-0a59-4eff-9541-a4ca6f149574"}]
                            ],
                            "on_success": [
                                [{"id": "0481e838-0a59-4eff-9541-a4ca6f149574"}]
                            ],
                        },
                    },
                }
            ],
            "next_page_token": "CAEomPuciYcxMKbM9JvMlwU=",
            "prev_page_token": "CAAos-uriYcxMN7_rt_v7B4=",
        }

    def list_jobs(self) -> Iterable[dict]:
        """
        Method returns List all the created jobs in a Databricks Workspace
        """
        try:
            if MOCK:
                response = self._get_mock_jobs_data()
                yield from response.get("jobs") or []
                return

            iteration_count = 1
            data = {"limit": PAGE_SIZE, "expand_tasks": True, "offset": 0}

            response = self.client.get(
                self.jobs_list_url,
                data=json.dumps(data),
                headers=self.headers,
                timeout=API_TIMEOUT,
            ).json()

            yield from response.get("jobs") or []

            while response and response.get("has_more"):
                data["offset"] = PAGE_SIZE * iteration_count

                response = self.client.get(
                    self.jobs_list_url,
                    data=json.dumps(data),
                    headers=self.headers,
                    timeout=API_TIMEOUT,
                ).json()
                iteration_count += 1
                yield from response.get("jobs") or []

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(exc)

    def _get_mock_job_runs_data(self) -> dict:
        """
        Returns mock data for job runs
        """
        return {
            "has_more": True,
            "next_page_token": "CAEomPuciYcxMKbM9JvMlwU=",
            "prev_page_token": "CAAos-uriYcxMN7_rt_v7B4=",
            "runs": [
                {
                    "attempt_number": 0,
                    "cleanup_duration": 0,
                    "cluster_instance": {
                        "cluster_id": "0923-164208-meows279",
                        "spark_context_id": "string",
                    },
                    "cluster_spec": {
                        "existing_cluster_id": "0923-164208-meows279",
                        "job_cluster_key": "string",
                        "libraries": [
                            {
                                "cran": {"package": "string", "repo": "string"},
                                "egg": "string",
                                "jar": "string",
                                "maven": {
                                    "coordinates": "string",
                                    "exclusions": ["string"],
                                    "repo": "string",
                                },
                                "pypi": {"package": "string", "repo": "string"},
                                "requirements": "string",
                                "whl": "string",
                            }
                        ],
                        "new_cluster": {
                            "apply_policy_default_values": False,
                            "autoscale": {"max_workers": 0, "min_workers": 0},
                            "autotermination_minutes": 0,
                            "aws_attributes": {
                                "availability": "SPOT",
                                "ebs_volume_count": 0,
                                "ebs_volume_iops": 0,
                                "ebs_volume_size": 0,
                                "ebs_volume_throughput": 0,
                                "ebs_volume_type": "GENERAL_PURPOSE_SSD",
                                "first_on_demand": 0,
                                "instance_profile_arn": "string",
                                "spot_bid_price_percent": 100,
                                "zone_id": "string",
                            },
                            "cluster_log_conf": {
                                "dbfs": {"destination": "string"},
                                "s3": {
                                    "canned_acl": "string",
                                    "destination": "string",
                                    "enable_encryption": True,
                                    "encryption_type": "string",
                                    "endpoint": "string",
                                    "kms_key": "string",
                                    "region": "string",
                                },
                                "volumes": {"destination": "string"},
                            },
                            "cluster_name": "string",
                            "custom_tags": {
                                "property1": "string",
                                "property2": "string",
                            },
                            "data_security_mode": "NONE",
                            "docker_image": {
                                "basic_auth": {
                                    "password": "string",
                                    "username": "string",
                                },
                                "url": "string",
                            },
                            "driver_instance_pool_id": "string",
                            "driver_node_type_id": "string",
                            "enable_elastic_disk": True,
                            "enable_local_disk_encryption": True,
                            "init_scripts": [
                                {
                                    "abfss": {"destination": "string"},
                                    "dbfs": {"destination": "string"},
                                    "file": {"destination": "string"},
                                    "gcs": {"destination": "string"},
                                    "s3": {
                                        "canned_acl": "string",
                                        "destination": "string",
                                        "enable_encryption": True,
                                        "encryption_type": "string",
                                        "endpoint": "string",
                                        "kms_key": "string",
                                        "region": "string",
                                    },
                                    "volumes": {"destination": "string"},
                                    "workspace": {"destination": "string"},
                                }
                            ],
                            "instance_pool_id": "string",
                            "is_single_node": True,
                            "kind": "CLASSIC_PREVIEW",
                            "node_type_id": "string",
                            "num_workers": 0,
                            "policy_id": "string",
                            "runtime_engine": "NULL",
                            "single_user_name": "string",
                            "spark_conf": {
                                "property1": "string",
                                "property2": "string",
                            },
                            "spark_env_vars": {
                                "property1": "string",
                                "property2": "string",
                            },
                            "spark_version": "string",
                            "ssh_public_keys": ["string"],
                            "use_ml_runtime": True,
                            "workload_type": {
                                "clients": {"jobs": True, "notebooks": True}
                            },
                        },
                    },
                    "creator_user_name": "user.name@databricks.com",
                    "description": "string",
                    "effective_performance_target": "PERFORMANCE_TARGET_UNSPECIFIED",
                    "end_time": 1625060863413,
                    "execution_duration": 0,
                    "git_source": {
                        "git_branch": "main",
                        "git_provider": "gitHub",
                        "git_url": "https://github.com/databricks/databricks-cli",
                    },
                    "job_clusters": [
                        {
                            "job_cluster_key": "auto_scaling_cluster",
                            "new_cluster": {
                                "autoscale": {"max_workers": 16, "min_workers": 2},
                                "node_type_id": None,
                                "spark_conf": {"spark.speculation": True},
                                "spark_version": "7.3.x-scala2.12",
                            },
                        }
                    ],
                    "job_id": 11223344,
                    "job_parameters": [
                        {"default": "users", "name": "table", "value": "customers"}
                    ],
                    "job_run_id": 0,
                    "number_in_job": 455644833,
                    "original_attempt_run_id": 455644833,
                    "overriding_parameters": {
                        "dbt_commands": ["dbt deps", "dbt seed", "dbt run"],
                        "jar_params": ["john", "doe", "35"],
                        "notebook_params": {"age": "35", "name": "john doe"},
                        "pipeline_params": {"full_refresh": False},
                        "python_named_params": {
                            "data": "dbfs:/path/to/data.json",
                            "name": "task",
                        },
                        "python_params": ["john doe", "35"],
                        "spark_submit_params": [
                            "--class",
                            "org.apache.spark.examples.SparkPi",
                        ],
                        "sql_params": {"age": "35", "name": "john doe"},
                    },
                    "queue_duration": 1625060863413,
                    "repair_history": [
                        {
                            "effective_performance_target": "PERFORMANCE_TARGET_UNSPECIFIED",
                            "end_time": 1625060863413,
                            "id": 734650698524280,
                            "start_time": 1625060460483,
                            "state": {
                                "life_cycle_state": "PENDING",
                                "queue_reason": "Queued due to reaching maximum concurrent runs of 1.",
                                "result_state": "SUCCESS",
                                "state_message": "string",
                                "user_cancelled_or_timedout": False,
                            },
                            "status": {
                                "queue_details": {
                                    "code": "ACTIVE_RUNS_LIMIT_REACHED",
                                    "message": "string",
                                },
                                "state": "BLOCKED",
                                "termination_details": {
                                    "code": "SUCCESS",
                                    "message": "string",
                                    "type": "SUCCESS",
                                },
                            },
                            "task_run_ids": [1106460542112844, 988297789683452],
                            "type": "ORIGINAL",
                        }
                    ],
                    "run_duration": 110183,
                    "run_id": 455644833,
                    "run_name": "A multitask job run",
                    "run_page_url": "https://my-workspace.cloud.databricks.com/#job/11223344/run/123",
                    "run_type": "JOB_RUN",
                    "schedule": {
                        "pause_status": "UNPAUSED",
                        "quartz_cron_expression": "20 30 * * * ?",
                        "timezone_id": "Europe/London",
                    },
                    "setup_duration": 0,
                    "start_time": 1625060460483,
                    "state": {
                        "life_cycle_state": "PENDING",
                        "queue_reason": "Queued due to reaching maximum concurrent runs of 1.",
                        "result_state": "SUCCESS",
                        "state_message": "string",
                        "user_cancelled_or_timedout": False,
                    },
                    "status": {
                        "queue_details": {
                            "code": "ACTIVE_RUNS_LIMIT_REACHED",
                            "message": "string",
                        },
                        "state": "BLOCKED",
                        "termination_details": {
                            "code": "SUCCESS",
                            "message": "string",
                            "type": "SUCCESS",
                        },
                    },
                    "tasks": [
                        {
                            "attempt_number": 0,
                            "cleanup_duration": 0,
                            "cluster_instance": {
                                "cluster_id": "0923-164208-meows279",
                                "spark_context_id": "4348585301701786933",
                            },
                            "description": "Ingests order data",
                            "end_time": 1629989930171,
                            "execution_duration": 0,
                            "job_cluster_key": "auto_scaling_cluster",
                            "libraries": [
                                {"jar": "dbfs:/mnt/databricks/OrderIngest.jar"}
                            ],
                            "run_id": 2112892,
                            "run_if": "ALL_SUCCESS",
                            "run_page_url": "https://my-workspace.cloud.databricks.com/#job/39832/run/20",
                            "setup_duration": 0,
                            "spark_jar_task": {
                                "main_class_name": "com.databricks.OrdersIngest"
                            },
                            "start_time": 1629989929660,
                            "state": {
                                "life_cycle_state": "INTERNAL_ERROR",
                                "result_state": "FAILED",
                                "state_message": "Library installation failed for library due to user error. Error messages:\n'Manage' permissions are required to install libraries on a cluster",
                                "user_cancelled_or_timedout": False,
                            },
                            "task_key": "Orders_Ingest",
                        },
                        {
                            "attempt_number": 0,
                            "cleanup_duration": 0,
                            "cluster_instance": {"cluster_id": "0923-164208-meows279"},
                            "depends_on": [
                                {"task_key": "Orders_Ingest"},
                                {"task_key": "Sessionize"},
                            ],
                            "description": "Matches orders with user sessions",
                            "end_time": 1629989930238,
                            "execution_duration": 0,
                            "new_cluster": {
                                "autoscale": {"max_workers": 16, "min_workers": 2},
                                "node_type_id": None,
                                "spark_conf": {"spark.speculation": True},
                                "spark_version": "7.3.x-scala2.12",
                            },
                            "notebook_task": {
                                "notebook_path": "/Users/user.name@databricks.com/Match",
                                "source": "WORKSPACE",
                            },
                            "run_id": 2112897,
                            "run_if": "ALL_SUCCESS",
                            "run_page_url": "https://my-workspace.cloud.databricks.com/#job/39832/run/21",
                            "setup_duration": 0,
                            "start_time": 0,
                            "state": {
                                "life_cycle_state": "SKIPPED",
                                "state_message": "An upstream task failed.",
                                "user_cancelled_or_timedout": False,
                            },
                            "task_key": "Match",
                        },
                        {
                            "attempt_number": 0,
                            "cleanup_duration": 0,
                            "cluster_instance": {
                                "cluster_id": "0923-164208-meows279",
                                "spark_context_id": "4348585301701786933",
                            },
                            "description": "Extracts session data from events",
                            "end_time": 1629989930144,
                            "execution_duration": 0,
                            "existing_cluster_id": "0923-164208-meows279",
                            "libraries": [
                                {"jar": "dbfs:/mnt/databricks/Sessionize.jar"}
                            ],
                            "run_id": 2112902,
                            "run_if": "ALL_SUCCESS",
                            "run_page_url": "https://my-workspace.cloud.databricks.com/#job/39832/run/22",
                            "setup_duration": 0,
                            "spark_jar_task": {
                                "main_class_name": "com.databricks.Sessionize"
                            },
                            "start_time": 1629989929668,
                            "state": {
                                "life_cycle_state": "INTERNAL_ERROR",
                                "result_state": "FAILED",
                                "state_message": "Library installation failed for library due to user error. Error messages:\n'Manage' permissions are required to install libraries on a cluster",
                                "user_cancelled_or_timedout": False,
                            },
                            "task_key": "Sessionize",
                        },
                    ],
                    "trigger": "PERIODIC",
                    "trigger_info": {"run_id": 0},
                }
            ],
        }

    def get_job_runs(self, job_id) -> List[dict]:
        """
        Method returns List of all runs for a job by the specified job_id
        """
        try:
            if MOCK:
                response = self._get_mock_job_runs_data()
                yield from response.get("runs") or []
                return

            params = {
                "job_id": job_id,
                "active_only": "false",
                "completed_only": "true",
                "run_type": "JOB_RUN",
                "expand_tasks": "true",
            }

            response = self.client.get(
                self.jobs_run_list_url,
                params=params,
                headers=self.headers,
                timeout=API_TIMEOUT,
            ).json()

            yield from response.get("runs") or []

            while response["has_more"]:
                params.update({"start_time_to": response["runs"][-1]["start_time"]})

                response = self.client.get(
                    self.jobs_run_list_url,
                    params=params,
                    headers=self.headers,
                    timeout=API_TIMEOUT,
                ).json()

                yield from response.get("runs") or []

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(exc)

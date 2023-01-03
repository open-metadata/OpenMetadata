#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
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
from typing import List

import requests

from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()
QUERY_WITH_OM_VERSION = '/* {"app": "OpenMetadata"'
QUERY_WITH_DBT = '/* {"app": "dbt"'


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
        self.base_query_url = f"https://{base_url}{api_version}/sql/history/queries"
        self.base_job_url = f"https://{base_url}{job_api_version}/jobs"
        self.jobs_list_url = f"{self.base_job_url}/list"
        self.jobs_run_list_url = f"{self.base_job_url}/runs/list"
        self.headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json",
        }
        self.client = requests

    def list_query_history(self, start_date=None, end_date=None) -> List[dict]:
        """
        Method returns List the history of queries through SQL warehouses
        """
        query_details = []
        try:
            next_page_token = None
            has_next_page = None

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
                        timeout=10,
                    ).json()

                    result = response.get("res")
                    data = {}

                while True:
                    if result:
                        query_details.extend(result)

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
                            timeout=10,
                        ).json()
                        result = response.get("res")

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(exc)

        return query_details

    def is_query_valid(self, row) -> bool:
        query_text = row.get("query_text")
        return not (
            query_text.startswith(QUERY_WITH_DBT)
            or query_text.startswith(QUERY_WITH_OM_VERSION)
        )

    def list_jobs(self) -> List[dict]:
        """
        Method returns List all the created jobs in a Databricks Workspace
        """
        job_list = []
        try:
            data = {"limit": 25, "expand_tasks": True, "offset": 0}

            response = self.client.get(
                self.jobs_list_url,
                data=json.dumps(data),
                headers=self.headers,
                timeout=10,
            ).json()

            job_list.extend(response["jobs"])

            while response["has_more"]:

                data["offset"] = len(response["jobs"])

                response = self.client.get(
                    self.jobs_list_url,
                    data=json.dumps(data),
                    headers=self.headers,
                    timeout=10,
                ).json()

                job_list.extend(response["jobs"])

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(exc)

        return job_list

    def get_job_runs(self, job_id) -> List[dict]:
        """
        Method returns List of all runs for a job by the specified job_id
        """
        job_runs = []
        try:
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
                timeout=10,
            ).json()

            job_runs.extend(response["runs"])

            while response["has_more"]:

                params.update({"start_time_to": response["runs"][-1]["start_time"]})

                response = self.client.get(
                    self.jobs_run_list_url,
                    params=params,
                    headers=self.headers,
                    timeout=10,
                ).json()

                job_runs.extend(response["runs"])

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(exc)

        return job_runs

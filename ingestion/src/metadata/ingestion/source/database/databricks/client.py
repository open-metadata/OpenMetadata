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

    def list_jobs(self) -> Iterable[dict]:
        """
        Method returns List all the created jobs in a Databricks Workspace
        """
        try:
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

    def get_job_runs(self, job_id) -> List[dict]:
        """
        Method returns List of all runs for a job by the specified job_id
        """
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

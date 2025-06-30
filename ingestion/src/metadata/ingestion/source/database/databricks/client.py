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
from typing import Iterable, List, Optional, Tuple, Union

import requests
from sqlalchemy import text
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.databricksPipelineConnection import (
    DatabricksPipelineConnection,
)
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.source.database.databricks.queries import (
    DATABRICKS_GET_COLUMN_LINEAGE_FOR_JOB,
    DATABRICKS_GET_TABLE_LINEAGE_FOR_JOB,
)
from metadata.utils.constants import QUERY_WITH_DBT, QUERY_WITH_OM_VERSION
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()
API_TIMEOUT = 10
PAGE_SIZE = 100
QUERIES_PATH = "/sql/history/queries"
API_VERSION = "/api/2.0"
JOB_API_VERSION = "/api/2.1"


class DatabricksClientException(Exception):
    """
    Class to throw auth and other databricks api exceptions.
    """


class DatabricksClient:
    """
    DatabricksClient creates a Databricks connection based on DatabricksCredentials.
    """

    def __init__(
        self,
        config: Union[DatabricksConnection, DatabricksPipelineConnection],
        engine: Optional[Engine] = None,
    ):
        self.config = config
        base_url, *_ = self.config.hostPort.split(":")
        auth_token = self.config.token.get_secret_value()
        self.base_url = f"https://{base_url}{API_VERSION}"
        self.base_query_url = f"{self.base_url}{QUERIES_PATH}"
        self.base_job_url = f"https://{base_url}{JOB_API_VERSION}/jobs"
        self.jobs_list_url = f"{self.base_job_url}/list"
        self.jobs_run_list_url = f"{self.base_job_url}/runs/list"
        self.headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json",
        }
        self.api_timeout = self.config.connectionTimeout or 120
        self.job_table_lineage: dict[str, list[dict[str, str]]] = {}
        self.job_column_lineage: dict[
            str, dict[Tuple[str, str], list[Tuple[str, str]]]
        ] = {}
        self.engine = engine
        self.client = requests

    def test_query_api_access(self) -> None:
        res = self.client.get(
            self.base_query_url, headers=self.headers, timeout=self.api_timeout
        )
        if res.status_code != 200:
            raise APIError(res.json)

    def test_lineage_query(self) -> None:
        try:
            with self.engine.connect() as connection:
                test_table_lineage = connection.execute(
                    text(DATABRICKS_GET_TABLE_LINEAGE_FOR_JOB + " LIMIT 1")
                )
                test_column_lineage = connection.execute(
                    text(DATABRICKS_GET_COLUMN_LINEAGE_FOR_JOB + " LIMIT 1")
                )
                # Check if queries executed successfully by fetching results
                table_result = test_table_lineage.fetchone()
                column_result = test_column_lineage.fetchone()
                logger.info("Lineage queries executed successfully")
        except Exception as exc:
            logger.debug(f"Error testing lineage queries: {traceback.format_exc()}")
            raise DatabricksClientException(
                f"Failed to test lineage queries Make sure you have access"
                "to the tables table_lineage and column_lineage: {exc}"
            )

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
                    timeout=self.api_timeout,
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
                        timeout=self.api_timeout,
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
            timeout=self.api_timeout,
        )
        if response.status_code != 200:
            raise DatabricksClientException(response.text)

    def list_jobs(self) -> Iterable[dict]:
        """
        Method returns List all the created jobs in a Databricks Workspace
        """
        self.cache_lineage()
        try:
            iteration_count = 1
            data = {"limit": PAGE_SIZE, "expand_tasks": True, "offset": 0}

            response = self.client.get(
                self.jobs_list_url,
                data=json.dumps(data),
                headers=self.headers,
                timeout=self.api_timeout,
            ).json()

            yield from response.get("jobs") or []

            while response and response.get("has_more"):
                data["offset"] = PAGE_SIZE * iteration_count

                response = self.client.get(
                    self.jobs_list_url,
                    data=json.dumps(data),
                    headers=self.headers,
                    timeout=self.api_timeout,
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
                timeout=self.api_timeout,
            ).json()

            yield from response.get("runs") or []

            while response["has_more"]:
                params.update({"start_time_to": response["runs"][-1]["start_time"]})

                response = self.client.get(
                    self.jobs_run_list_url,
                    params=params,
                    headers=self.headers,
                    timeout=self.api_timeout,
                ).json()

                yield from response.get("runs") or []

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(exc)

    def get_table_lineage(self, job_id: str) -> List[dict[str, str]]:
        """
        Method returns table lineage for a job by the specified job_id
        """
        try:
            return self.job_table_lineage.get(str(job_id))
        except Exception as exc:
            logger.debug(
                f"Error getting table lineage for job {job_id} due to {traceback.format_exc()}"
            )
            logger.error(exc)
        return []

    def get_column_lineage(
        self, job_id: str, TableKey: Tuple[str, str]
    ) -> List[Tuple[str, str]]:
        """
        Method returns column lineage for a job by the specified job_id and table key
        """
        try:
            return self.job_column_lineage.get(str(job_id), {}).get(TableKey)
        except Exception as exc:
            logger.debug(
                f"Error getting column lineage for table {TableKey} due to {traceback.format_exc()}"
            )
            logger.error(exc)
        return []

    def run_lineage_query(self, query: str) -> List[dict]:
        """
        Method runs a lineage query and returns the result
        """
        try:
            with self.engine.connect() as connection:
                result = connection.execute(text(query))
                return result

        except Exception as exc:
            logger.debug(f"Error caching table lineage due to {traceback.format_exc()}")
            logger.error(exc)
        return []

    def cache_lineage(self):
        """
        Method caches table and column lineage for a job by the specified job_id
        """
        logger.info(f"Caching table lineage")
        table_lineage = self.run_lineage_query(DATABRICKS_GET_TABLE_LINEAGE_FOR_JOB)
        if table_lineage:
            for row in table_lineage:
                try:
                    if row.job_id not in self.job_table_lineage:
                        self.job_table_lineage[row.job_id] = []
                    self.job_table_lineage[row.job_id].append(
                        {
                            "source_table_full_name": row.source_table_full_name,
                            "target_table_full_name": row.target_table_full_name,
                        }
                    )
                except Exception as exc:
                    logger.debug(
                        f"Error parsing row: {row} due to {traceback.format_exc()}"
                    )
                    continue

        # Not every job has column lineage, so we need to check if the job exists in the column_lineage table
        # we will cache the column lineage for jobs that have column lineage
        logger.info("Caching column lineage")
        column_lineage = self.run_lineage_query(DATABRICKS_GET_COLUMN_LINEAGE_FOR_JOB)
        if column_lineage:
            for row in column_lineage:
                try:
                    table_key = (
                        row.source_table_full_name,
                        row.target_table_full_name,
                    )
                    column_pair = (
                        row.source_column_name,
                        row.target_column_name,
                    )

                    if row.job_id not in self.job_column_lineage:
                        self.job_column_lineage[row.job_id] = {}

                    if table_key not in self.job_column_lineage[row.job_id]:
                        self.job_column_lineage[row.job_id][table_key] = []

                    self.job_column_lineage[row.job_id][table_key].append(column_pair)

                except Exception as exc:
                    logger.debug(
                        f"Error parsing row: {row} due to {traceback.format_exc()}"
                    )
                    continue

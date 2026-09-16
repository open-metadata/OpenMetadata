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

import base64
import json
import traceback
from collections import defaultdict
from datetime import timedelta
from typing import Iterable, List, Optional, Tuple, Union  # noqa: UP035

import requests
from sqlalchemy import text
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.databricks.azureAdSetup import (
    AzureAdSetup,
)
from metadata.generated.schema.entity.services.connections.database.databricks.databricksOAuth import (
    DatabricksOauth,
)
from metadata.generated.schema.entity.services.connections.database.databricks.personalAccessToken import (
    PersonalAccessToken,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.databricksPipelineConnection import (
    DatabricksPipelineConnection,
)
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.source.database.databricks.queries import (
    DATABRICKS_GET_COLUMN_LINEAGE,
    DATABRICKS_GET_TABLE_LINEAGE,
)
from metadata.ingestion.source.database.databricks.user_agent import (
    get_databricks_user_agent,
)
from metadata.utils.constants import QUERY_WITH_DBT, QUERY_WITH_OM_VERSION
from metadata.utils.helpers import datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()
API_TIMEOUT = 10
PAGE_SIZE = 100
QUERIES_PATH = "/sql/history/queries"
API_VERSION = "/api/2.0"
# 2.2 is the first Jobs API version that can return a job with more than 100 tasks.
# Earlier versions omit `settings.tasks` for such a job without signalling it.
JOB_API_VERSION = "/api/2.2"
# runs/list rejects any limit above 26, unlike jobs/list which allows up to 100.
RUNS_PAGE_SIZE = 25
# A walk longer than this is a misbehaving service rather than a large workspace:
# it is a million jobs at PAGE_SIZE. It also bounds the seen-token set.
MAX_PAGES = 10_000
SCIM_SERVICE_PRINCIPALS_PATH = "/preview/scim/v2/ServicePrincipals"
SCIM_GROUPS_PATH = "/preview/scim/v2/Groups"


class DatabricksClientException(Exception):  # noqa: N818
    """
    Class to throw auth and other databricks api exceptions.
    """


class DatabricksClient:
    """
    DatabricksClient creates a Databricks connection based on DatabricksCredentials.
    """

    def __init__(
        self,
        config: Union[DatabricksConnection, DatabricksPipelineConnection, UnityCatalogConnection],  # noqa: UP007
        engine: Optional[Engine] = None,  # noqa: UP045
    ):
        self.config = config
        base_url, *_ = self.config.hostPort.split(":")
        self.base_url = f"https://{base_url}{API_VERSION}"
        self.base_query_url = f"{self.base_url}{QUERIES_PATH}"
        self.base_job_url = f"https://{base_url}{JOB_API_VERSION}/jobs"
        self.jobs_list_url = f"{self.base_job_url}/list"
        self.jobs_run_list_url = f"{self.base_job_url}/runs/list"
        self.api_timeout = self.config.connectionTimeout or 120
        self._entity_table_lineage_executed: bool = False
        self.entity_table_lineage: dict[str, list[dict[str, str]]] = defaultdict(list)
        self._entity_column_lineage_executed: bool = False
        self.entity_column_lineage: dict[str, dict[Tuple[str, str], list[Tuple[str, str]]]] = defaultdict(  # noqa: UP006
            lambda: defaultdict(list)
        )
        self.engine = engine
        self.client = requests

    def _get_auth_header(self) -> dict[str, str]:
        """
        Method to get auth header
        """
        from metadata.ingestion.source.database.databricks import auth  # noqa: PLC0415

        auth_method = {
            PersonalAccessToken: auth.get_personal_access_token_auth,
            DatabricksOauth: auth.get_databricks_oauth_auth,
            AzureAdSetup: auth.get_azure_ad_auth,
        }.get(type(self.config.authType))
        if not auth_method:
            raise ValueError(f"Unsupported authentication type: {type(self.config.authType)}")

        auth_args = auth_method(self.config)
        if auth_args.get("access_token"):
            return {"Authorization": f"Bearer {auth_args['access_token']}"}

        return auth_args["credentials_provider"]()()

    @property
    def headers(self) -> dict[str, str]:
        """
        Return auth headers for each API request.
        """
        return {
            **self._get_auth_header(),
            "Content-Type": "application/json",
            "User-Agent": get_databricks_user_agent(),
        }

    def _list_scim_resources(self, path: str, filter_expression: str | None = None) -> Iterable[dict]:
        """
        List workspace SCIM resources using Databricks' 1-based pagination.
        """
        start_index = 1
        while True:
            params: dict[str, str | int] = {"startIndex": start_index, "count": PAGE_SIZE}
            if filter_expression:
                params["filter"] = filter_expression
            response = self.client.get(
                f"{self.base_url}{path}",
                headers=self.headers,
                params=params,
                timeout=self.api_timeout,
            )
            if response.status_code != 200:
                raise DatabricksClientException(
                    f"Failed to list Databricks SCIM resources from [{path}]. "
                    f"Status code: {response.status_code}, response: {response.text}"
                )

            payload = response.json()
            resources = payload.get("Resources") or []
            yield from resources

            # Guard against non-positive itemsPerPage so start_index always advances.
            items_per_page = int(payload.get("itemsPerPage") or 0)
            if items_per_page <= 0:
                items_per_page = len(resources)
            total_results = int(payload.get("totalResults") or 0)
            current_start = int(payload.get("startIndex") or start_index)
            if not resources or current_start + items_per_page > total_results:
                break
            start_index = current_start + items_per_page

    def list_service_principals(self, filter_expression: str | None = None) -> Iterable[dict]:
        """
        List Databricks workspace service principals from SCIM.
        """
        yield from self._list_scim_resources(SCIM_SERVICE_PRINCIPALS_PATH, filter_expression)

    def list_groups(self, filter_expression: str | None = None) -> Iterable[dict]:
        """
        List Databricks workspace groups from SCIM.
        """
        yield from self._list_scim_resources(SCIM_GROUPS_PATH, filter_expression)

    def test_query_api_access(self) -> None:
        res = self.client.get(self.base_query_url, headers=self.headers, timeout=self.api_timeout)
        if res.status_code != 200:
            raise APIError(res.json)

    def test_lineage_query(self) -> None:
        try:
            lookback_days = getattr(self.config, "lineageLookBackDays", 90)
            with self.engine.connect() as connection:
                test_table_lineage = connection.execute(
                    text(DATABRICKS_GET_TABLE_LINEAGE.format(lookback_days=lookback_days) + " LIMIT 1")
                )
                test_column_lineage = connection.execute(
                    text(DATABRICKS_GET_COLUMN_LINEAGE.format(lookback_days=lookback_days) + " LIMIT 1")
                )
                # Check if queries executed successfully by fetching results
                table_result = test_table_lineage.fetchone()  # noqa: F841
                column_result = test_column_lineage.fetchone()  # noqa: F841
                logger.info("Lineage queries executed successfully")
        except Exception as exc:
            logger.debug(f"Error testing lineage queries: {traceback.format_exc()}")
            raise DatabricksClientException(  # noqa: B904
                f"Failed to test lineage queries. Make sure you have access "
                f"to the tables table_lineage and column_lineage: {exc}"
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

    def list_query_history(self, start_date=None, end_date=None) -> List[dict]:  # noqa: UP006
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
                yield from (
                    self._run_query_paginator(data=data, result=result, end_time=end_time, response=response) or []
                )

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(exc)

    def is_query_valid(self, row) -> bool:
        query_text = row.get("query_text")
        return not (query_text.startswith(QUERY_WITH_DBT) or query_text.startswith(QUERY_WITH_OM_VERSION))  # noqa: PIE810

    def _get_json(self, url: str, params: dict) -> dict:
        """
        GET a Jobs API page, refusing to treat an error body as an empty page.

        Databricks answers a rejected request with a 200-shaped JSON body, so calling
        .json() without checking the status silently turns a failure into "no more
        results" and truncates whatever was being paginated.
        """
        response = self.client.get(
            url,
            params=params,
            headers=self.headers,
            timeout=self.api_timeout,
        )
        if response.status_code != 200:
            raise DatabricksClientException(
                f"Databricks API call to [{url}] failed with status {response.status_code}: {response.text}"
            )
        return response.json()

    def _paginate_responses(self, url: str, params: dict) -> Iterable[dict]:
        """
        Yield each page of a token-paginated Jobs API response.

        Token pagination rather than `offset` because Databricks caps `offset` at 1000,
        and because API 2.2 drops the root-level `has_more` that the offset loop needed
        to know when to stop.

        Raises rather than stops if the walk cannot terminate, either because a token
        is reissued (any cycle, not only an immediate repeat) or because the service
        never stops handing out fresh ones. Stopping quietly would be one more way to
        truncate a listing while reporting success.
        """
        page_params = dict(params)
        seen_tokens: set[str] = set()
        while True:
            payload = self._get_json(url, page_params)
            yield payload

            next_page_token = payload.get("next_page_token")
            if not next_page_token:
                return
            if next_page_token in seen_tokens:
                raise DatabricksClientException(
                    f"Databricks reissued a page token already seen while paginating [{url}]. "
                    f"Refusing to loop over the same pages."
                )
            if len(seen_tokens) >= MAX_PAGES:
                raise DatabricksClientException(
                    f"Pagination of [{url}] passed {MAX_PAGES} pages without ending. Refusing to keep requesting."
                )
            seen_tokens.add(next_page_token)
            page_params["page_token"] = next_page_token

    def _paginate_items(self, url: str, params: dict, key: str) -> Iterable[dict]:
        """
        Walk a Jobs API list endpoint, flattening every page into its items.
        """
        for payload in self._paginate_responses(url, params):
            yield from payload.get(key) or []

    def _expand_job_tasks(self, job: dict) -> dict:
        """
        Fill in the tasks that jobs/list left out.

        List responses carry at most 100 elements of any list field and set a per-job
        `has_more` when a job has more. Pipeline lineage is built from the task list, so
        a job left truncated here loses both its tasks and its lineage.

        Unlike a failure to list jobs, a failure here degrades rather than raises: it
        costs one job an accurate task list, where a short job list costs the catalogue
        every job that never arrived.
        """
        if not job.get("has_more"):
            return job

        job_id = job.get("job_id")
        try:
            tasks: list[dict] = []
            for payload in self._paginate_responses(f"{self.base_job_url}/get", {"job_id": job_id}):
                tasks.extend((payload.get("settings") or {}).get("tasks") or [])
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                "Could not fetch the full task list for job %s, keeping the first page only. "
                "Its tasks and lineage will be incomplete: %s",
                job_id,
                exc,
            )
            return job

        expanded = {**job, "settings": {**(job.get("settings") or {}), "tasks": tasks}}
        expanded.pop("has_more", None)
        return expanded

    def list_jobs_test_connection(self) -> None:
        self._get_json(self.jobs_list_url, {"limit": 1, "expand_tasks": "true"})

    def list_jobs(self) -> Iterable[dict]:
        """
        Yield every job in the workspace, each with its full task list.

        Raises rather than stopping short if the workspace cannot be listed, because a
        truncated job list is indistinguishable from a smaller workspace.
        """
        # "true" lowercase: Databricks ignores the Python bool's "True" encoding
        # without complaining, which would drop every task list.
        params = {"limit": PAGE_SIZE, "expand_tasks": "true"}
        for job in self._paginate_items(self.jobs_list_url, params, key="jobs"):
            yield self._expand_job_tasks(job)

    def get_job_runs(self, job_id) -> Iterable[dict]:
        """
        Yield the completed runs of one job, newest first.

        Yields nothing and logs if the runs cannot be listed, since a missing run costs
        only pipeline status.
        """
        params = {
            "job_id": job_id,
            "limit": RUNS_PAGE_SIZE,
            "active_only": "false",
            "completed_only": "true",
            "run_type": "JOB_RUN",
            "expand_tasks": "true",
        }
        try:
            yield from self._paginate_items(self.jobs_run_list_url, params, key="runs")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Could not list runs for job %s: %s", job_id, exc)

    def get_table_lineage(self, entity_id: str) -> List[dict[str, str]]:  # noqa: UP006
        """
        Method returns table lineage for a job or pipeline by the specified entity_id.
        On first call, eagerly fetches ALL lineage in bulk for optimal performance.
        """
        try:
            if not self._entity_table_lineage_executed:
                logger.info("First lineage request detected - performing bulk lineage fetch for all entities")
                self.cache_lineage()

            return self.entity_table_lineage.get(str(entity_id), [])

        except Exception as exc:
            logger.debug(f"Error getting table lineage for {entity_id} due to {traceback.format_exc()}")
            logger.error(exc)
        return []

    def get_column_lineage(self, entity_id: str, TableKey: Tuple[str, str]) -> List[Tuple[str, str]]:  # noqa: N803, UP006
        """
        Method returns column lineage for a job or pipeline by the specified entity_id and table key
        """
        try:
            if not self._entity_column_lineage_executed:
                logger.debug("Entity column lineage not found. Executing cache_lineage...")
                self.cache_lineage()

            return self.entity_column_lineage.get(str(entity_id), {}).get(TableKey, [])

        except Exception as exc:
            logger.debug(f"Error getting column lineage for table {TableKey} due to {traceback.format_exc()}")
            logger.error(exc)
        return []

    def run_lineage_query(self, query: str) -> List[dict]:  # noqa: UP006
        """
        Method runs a lineage query and returns the result
        """
        try:
            with self.engine.connect() as connection:
                result = connection.execute(text(query))
                return result  # noqa: RET504

        except Exception as exc:
            logger.debug(f"Error caching table lineage due to {traceback.format_exc()}")
            logger.error(exc)
        return []

    def cache_lineage(self):
        """
        Method caches table and column lineage for ALL jobs and pipelines.
        """
        lookback_days = getattr(self.config, "lineageLookBackDays", 90)
        logger.info(f"Caching table lineage (lookback: {lookback_days} days)")
        table_lineage = self.run_lineage_query(DATABRICKS_GET_TABLE_LINEAGE.format(lookback_days=lookback_days))
        for row in table_lineage or []:
            try:
                self.entity_table_lineage[row.entity_id].append(
                    {
                        "source_table_full_name": row.source_table_full_name,
                        "target_table_full_name": row.target_table_full_name,
                    }
                )
            except Exception as exc:  # noqa: F841
                logger.debug(f"Error parsing row: {row} due to {traceback.format_exc()}")
                continue
        self._entity_table_lineage_executed = True

        logger.info(f"Caching column lineage (lookback: {lookback_days} days)")
        column_lineage = self.run_lineage_query(DATABRICKS_GET_COLUMN_LINEAGE.format(lookback_days=lookback_days))
        for row in column_lineage or []:
            try:
                table_key = (
                    row.source_table_full_name,
                    row.target_table_full_name,
                )
                column_pair = (
                    row.source_column_name,
                    row.target_column_name,
                )

                self.entity_column_lineage[row.entity_id][table_key].append(column_pair)

            except Exception as exc:  # noqa: F841
                logger.debug(f"Error parsing row: {row} due to {traceback.format_exc()}")
                continue
        self._entity_column_lineage_executed = True
        logger.debug("Table and column lineage caching completed.")

    def get_pipeline_details(self, pipeline_id: str) -> Optional[dict]:  # noqa: UP045
        """
        Get DLT pipeline configuration including libraries and notebooks
        """
        try:
            url = f"{self.base_url}/pipelines/{pipeline_id}"
            response = self.client.get(
                url,
                headers=self.headers,
                timeout=self.api_timeout,
            )
            if response.status_code == 200:
                return response.json()
            logger.warning(f"Failed to get pipeline details for {pipeline_id}: {response.status_code}")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error getting pipeline details for {pipeline_id}: {exc}")
        return None

    def list_pipelines(self) -> Iterable[dict]:
        """
        List all DLT (Delta Live Tables) pipelines in the workspace
        Uses the Pipelines API (/api/2.0/pipelines)
        """
        try:
            url = f"{self.base_url}/pipelines"
            params = {"max_results": PAGE_SIZE}

            response = self.client.get(
                url,
                params=params,
                headers=self.headers,
                timeout=self.api_timeout,
            )

            if response.status_code == 200:
                data = response.json()
                pipelines = data.get("statuses", [])
                logger.info(f"Found {len(pipelines)} DLT pipelines")
                yield from pipelines

                # Handle pagination if there's a next_page_token
                while data.get("next_page_token"):
                    params["page_token"] = data["next_page_token"]
                    response = self.client.get(
                        url,
                        params=params,
                        headers=self.headers,
                        timeout=self.api_timeout,
                    )
                    if response.status_code == 200:
                        data = response.json()
                        yield from data.get("statuses", [])
                    else:
                        break
            else:
                logger.warning(f"Failed to list pipelines: {response.status_code} - {response.text}")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error listing DLT pipelines: {exc}")

    def list_workspace_objects(self, path: str) -> List[dict]:  # noqa: UP006
        """
        List objects in a Databricks workspace directory
        """
        try:
            url = f"{self.base_url}/workspace/list"
            params = {"path": path}

            response = self.client.get(
                url,
                params=params,
                headers=self.headers,
                timeout=self.api_timeout,
            )

            if response.status_code == 200:
                return response.json().get("objects", [])
            else:  # noqa: RET505
                logger.warning(f"Failed to list workspace directory {path}: {response.text}")
                return []
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error listing workspace directory {path}: {exc}")
            return []

    def export_notebook_source(self, notebook_path: str) -> Optional[str]:  # noqa: UP045
        """
        Export notebook source code from Databricks workspace
        """
        try:
            url = f"{self.base_url}/workspace/export"
            params = {"path": notebook_path, "format": "SOURCE"}

            response = self.client.get(
                url,
                params=params,
                headers=self.headers,
                timeout=self.api_timeout,
            )

            if response.status_code == 200:
                content = response.json().get("content")
                if content:
                    return base64.b64decode(content).decode("utf-8")
            logger.warning(f"Failed to export notebook {notebook_path}: {response.status_code}")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error exporting notebook {notebook_path}: {exc}")
        return None

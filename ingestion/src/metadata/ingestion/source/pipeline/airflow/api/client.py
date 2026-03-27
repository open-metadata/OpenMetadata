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
Client to interact with the Airflow REST API
"""
import traceback
from typing import List, Optional
from urllib.parse import quote

from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import HTTPError

from metadata.generated.schema.entity.services.connections.pipeline.airflowConnection import (
    AirflowConnection,
)
from metadata.generated.schema.entity.utils.common.accessTokenConfig import AccessToken
from metadata.generated.schema.entity.utils.common.basicAuthConfig import BasicAuth
from metadata.generated.schema.entity.utils.common.gcpCredentialsConfig import (
    GcpServiceAccount,
)
from metadata.generated.schema.entity.utils.common.mwaaAuthConfig import (
    MwaaAuthentication,
)
from metadata.ingestion.connections.source_api_client import TrackedREST
from metadata.ingestion.ometa.client import ClientConfig
from metadata.ingestion.source.pipeline.airflow.api.auth import (
    build_access_token_callback,
    build_basic_auth_callback,
    build_gcp_token_callback,
)
from metadata.ingestion.source.pipeline.airflow.api.models import (
    AirflowApiDagDetails,
    AirflowApiDagRun,
    AirflowApiTask,
    AirflowApiTaskInstance,
)
from metadata.ingestion.source.pipeline.airflow.api.mwaa import MWAAClient
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class AirflowApiClient:
    """
    Client to interact with the Airflow REST API (v1 for Airflow 2.x, v2 for Airflow 3.x)
    """

    def __init__(self, config: AirflowConnection):
        self.config = config
        self._detected_version: Optional[str] = None

        rest_config = config.connection
        auth_config = rest_config.authConfig

        # Check if this is MWAA (AWS credentials)
        if isinstance(auth_config, MwaaAuthentication):
            # Use MWAA client for AWS managed Airflow
            environment_name = auth_config.mwaaConfig.mwaaEnvironmentName
            self.mwaa_client = MWAAClient(
                auth_config.mwaaConfig.awsConfig, environment_name
            )
            self.client = None  # No need for TrackedREST client with MWAA
        else:
            # Use standard REST client for other authentication types
            self.mwaa_client = None
            auth_token_mode = "Bearer"

            if isinstance(auth_config, AccessToken):
                auth_token_fn = build_access_token_callback(
                    auth_config.token.get_secret_value()
                )
            elif isinstance(auth_config, BasicAuth):
                auth_token_fn, auth_token_mode = build_basic_auth_callback(
                    host=clean_uri(str(config.hostPort)),
                    username=auth_config.username,
                    password=auth_config.password.get_secret_value(),
                    verify=rest_config.verifySSL,
                )
            elif isinstance(auth_config, GcpServiceAccount):
                auth_token_fn = build_gcp_token_callback(auth_config.credentials)
            else:
                auth_token_fn = None

            client_config = ClientConfig(
                base_url=clean_uri(str(config.hostPort)),
                api_version="api",
                auth_header="Authorization" if auth_token_fn else None,
                auth_token=auth_token_fn,
                auth_token_mode=auth_token_mode,
                verify=rest_config.verifySSL,
            )
            self.client = TrackedREST(client_config, source_name="airflow_api")

    @property
    def api_version(self) -> str:
        if self._detected_version:
            return self._detected_version

        # Use MWAA client - no version detection needed
        if self.mwaa_client:
            self._detected_version = "v1"  # MWAA handles versioning internally
            return self._detected_version

        rest_config = self.config.connection
        configured = (
            str(rest_config.apiVersion.value) if rest_config.apiVersion else "auto"
        )
        if configured != "auto":
            self._detected_version = configured
            return self._detected_version

        self._detected_version = self._detect_api_version()
        return self._detected_version

    def _detect_api_version(self) -> str:
        for version in ("v2", "v1"):
            try:
                self.client.get(f"/{version}/version")
                return version
            except HTTPError as exc:
                if exc.response is not None and exc.response.status_code in (401, 403):
                    raise
                logger.debug(traceback.format_exc())
            except (RequestsConnectionError, TimeoutError, OSError):
                raise
            except Exception:
                logger.debug(traceback.format_exc())
        logger.warning("Could not detect Airflow API version, defaulting to v1")
        return "v1"

    @property
    def _prefix(self) -> str:
        return f"/{self.api_version}"

    @property
    def _date_field(self) -> str:
        return "logical_date" if self.api_version == "v2" else "execution_date"

    def _parse_response(self, response):
        """Parse response, handling both dict and Response objects"""
        if hasattr(response, "json"):
            try:
                return response.json()
            except Exception as exc:
                logger.warning(f"Failed to parse JSON response: {exc}")
                logger.warning(
                    f"Response content type: {response.headers.get('content-type')}"
                )
                logger.debug(f"Response status code: {response.status_code}")
                logger.debug(f"Response text: {response.text[:500]}")
                return {}
        return response

    def get_version(self) -> dict:
        if self.mwaa_client:
            return self.mwaa_client.get_version()

        response = self.client.get(f"{self._prefix}/version")
        return self._parse_response(response)

    def list_dags(self, limit: int = 100, offset: int = 0) -> dict:
        if self.mwaa_client:
            return self.mwaa_client.list_dags(limit=limit, offset=offset)

        response = self.client.get(f"{self._prefix}/dags?limit={limit}&offset={offset}")
        return self._parse_response(response)

    def get_dag_tasks(self, dag_id: str) -> dict:
        if self.mwaa_client:
            return self.mwaa_client.get_dag_tasks(dag_id)

        response = self.client.get(
            f"{self._prefix}/dags/{quote(dag_id, safe='')}/tasks"
        )
        return self._parse_response(response)

    def list_dag_runs(self, dag_id: str, limit: int = 10) -> dict:
        if self.mwaa_client:
            return self.mwaa_client.list_dag_runs(dag_id, limit=limit)

        response = self.client.get(
            f"{self._prefix}/dags/{quote(dag_id, safe='')}/dagRuns"
            f"?limit={limit}&order_by=-{self._date_field}"
        )
        return self._parse_response(response)

    def get_task_instances(self, dag_id: str, dag_run_id: str) -> dict:
        if self.mwaa_client:
            return self.mwaa_client.get_task_instances(dag_id, dag_run_id)

        response = self.client.get(
            f"{self._prefix}/dags/{quote(dag_id, safe='')}"
            f"/dagRuns/{quote(dag_run_id, safe='')}/taskInstances"
        )
        return self._parse_response(response)

    def _paginate(self, path: str, key: str, limit: int = 100) -> List[dict]:
        result: List[dict] = []
        offset = 0
        total = limit
        while offset < total:
            separator = "&" if "?" in path else "?"
            response = self.client.get(
                f"{path}{separator}limit={limit}&offset={offset}"
            )

            response = self._parse_response(response)
            if not response:
                break

            page = response.get(key, [])
            if not page:
                break
            result.extend(page)
            total = response.get("total_entries", len(result))
            offset += limit
        return result

    def get_all_dags(self) -> List[dict]:
        if self.mwaa_client:
            return self.mwaa_client.get_all_dags()

        return self._paginate(f"{self._prefix}/dags", key="dags")

    def build_dag_details(self, dag_data: dict) -> AirflowApiDagDetails:
        if self.mwaa_client:
            return self.mwaa_client.build_dag_details(dag_data)

        dag_id = dag_data["dag_id"]

        tags_raw = dag_data.get("tags") or []
        tags = []
        for tag in tags_raw:
            if isinstance(tag, dict):
                name = tag.get("name")
            elif isinstance(tag, str):
                name = tag
            else:
                continue
            if name:
                tags.append(str(name))

        owners = dag_data.get("owners") or []

        if self.api_version == "v2":
            schedule = dag_data.get("timetable_summary")
        else:
            schedule = dag_data.get("schedule_interval")
            if isinstance(schedule, dict):
                schedule = schedule.get("value")

        try:
            task_response = self.get_dag_tasks(dag_id)
            tasks_data = task_response.get("tasks", [])
        except Exception as exc:
            logger.warning(f"Could not fetch tasks for DAG {dag_id}: {exc}")
            tasks_data = []

        tasks = [
            AirflowApiTask(
                task_id=t["task_id"],
                downstream_task_ids=t.get("downstream_task_ids"),
                owner=t.get("owner"),
                doc_md=t.get("doc_md"),
                start_date=t.get("start_date"),
                end_date=t.get("end_date"),
                class_ref=t.get("class_ref"),
            )
            for t in tasks_data
        ]

        return AirflowApiDagDetails(
            dag_id=dag_id,
            description=dag_data.get("description"),
            fileloc=dag_data.get("fileloc") or dag_data.get("file_loc"),
            is_paused=dag_data.get("is_paused"),
            owners=owners,
            tags=tags,
            schedule_interval=schedule,
            max_active_runs=dag_data.get("max_active_runs"),
            start_date=dag_data.get("start_date"),
            tasks=tasks,
        )

    def get_dag_runs(self, dag_id: str, limit: int = 10) -> List[AirflowApiDagRun]:
        if self.mwaa_client:
            return self.mwaa_client.get_dag_runs(dag_id, limit=limit)

        try:
            response = self.list_dag_runs(dag_id, limit=limit)
            runs_data = response.get("dag_runs", [])
        except Exception as exc:
            logger.warning(f"Could not fetch dag runs for {dag_id}: {exc}")
            return []

        result = []
        for run in runs_data:
            execution_date = run.get("logical_date") or run.get("execution_date")
            result.append(
                AirflowApiDagRun(
                    dag_run_id=run.get("dag_run_id", ""),
                    state=run.get("state"),
                    execution_date=execution_date,
                    start_date=run.get("start_date"),
                    end_date=run.get("end_date"),
                )
            )
        return result

    def get_task_instances_for_run(
        self, dag_id: str, dag_run_id: str
    ) -> List[AirflowApiTaskInstance]:
        if self.mwaa_client:
            return self.mwaa_client.get_task_instances_for_run(dag_id, dag_run_id)

        try:
            path = (
                f"{self._prefix}/dags/{quote(dag_id, safe='')}"
                f"/dagRuns/{quote(dag_run_id, safe='')}/taskInstances"
            )
            instances_data = self._paginate(path, key="task_instances")
        except Exception as exc:
            logger.warning(
                f"Could not fetch task instances for {dag_id}/{dag_run_id}: {exc}"
            )
            return []

        return [
            AirflowApiTaskInstance(
                task_id=ti.get("task_id", ""),
                state=ti.get("state"),
                start_date=ti.get("start_date"),
                end_date=ti.get("end_date"),
            )
            for ti in instances_data
        ]

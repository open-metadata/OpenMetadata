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
MWAA (Managed Workflows for Apache Airflow) REST API implementation
Uses AWS MWAA invoke_rest_api for direct API calls without token management
"""
import json
import traceback
from typing import Dict, List, Optional
from urllib.parse import quote

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.ingestion.source.pipeline.airflow.api.models import (
    AirflowApiDagDetails,
    AirflowApiDagRun,
    AirflowApiTask,
    AirflowApiTaskInstance,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MWAAClient:
    """
    MWAA client that uses AWS MWAA invoke_rest_api for direct Airflow REST API calls.
    This approach bypasses token management and uses AWS IAM permissions directly.
    """

    def __init__(self, aws_credentials: AWSCredentials, environment_name: str):
        self.aws_credentials = aws_credentials
        self.environment_name = environment_name
        self._aws_client = AWSClient(aws_credentials)
        self._mwaa_client = self._aws_client.get_mwaa_client()

    def _invoke_rest_api(
        self,
        path: str,
        method: str = "GET",
        body: Optional[Dict] = None,
        query: Optional[Dict] = None,
    ) -> Dict:
        """
        Invoke MWAA REST API using AWS MWAA invoke_rest_api method.

        Args:
            path: API path (e.g., "/dags")
            method: HTTP method (GET, POST, etc.)
            body: Request body for POST/PUT requests
            query: Query parameters

        Returns:
            Response from Airflow REST API
        """
        try:
            params = {"Name": self.environment_name, "Path": path, "Method": method}

            if body:
                params["Body"] = json.dumps(body) if isinstance(body, dict) else body

            if query:
                params["QueryParameters"] = query

            response = self._mwaa_client.invoke_rest_api(**params)
            rest_api_response = response.get("RestApiResponse", {})

            # Handle different response formats
            if isinstance(rest_api_response, str):
                try:
                    return json.loads(rest_api_response)
                except json.JSONDecodeError:
                    logger.warning(
                        f"Failed to parse MWAA response as JSON: {rest_api_response}"
                    )
                    return {"raw_response": rest_api_response}

            return rest_api_response

        except Exception as e:
            logger.error(f"MWAA REST API call failed for {path}: {e}")
            logger.debug(traceback.format_exc())
            raise

    def get_version(self) -> Dict:
        """Get basic connection info - MWAA doesn't expose version endpoint"""
        # Return a simple response to indicate connectivity
        return {"version": "MWAA", "status": "connected"}

    def list_dags(self, limit: int = 100, offset: int = 0) -> Dict:
        """List DAGs with pagination"""
        query = {"limit": str(limit), "offset": str(offset)}
        return self._invoke_rest_api("/dags", query=query)

    def get_dag_tasks(self, dag_id: str) -> Dict:
        """Get tasks for a specific DAG"""
        return self._invoke_rest_api(f"/dags/{quote(dag_id, safe='')}/tasks")

    def list_dag_runs(self, dag_id: str, limit: int = 10) -> Dict:
        """List DAG runs for a specific DAG"""
        query_param = "?order_by=-start_date"
        query_param += f"&limit={limit}" if limit is not None else ""
        return self._invoke_rest_api(
            f"/dags/{quote(dag_id, safe='')}/dagRuns{query_param}",
        )

    def get_task_instances(self, dag_id: str, dag_run_id: str) -> Dict:
        """Get task instances for a specific DAG run"""
        return self._invoke_rest_api(
            f"/dags/{quote(dag_id, safe='')}"
            f"/dagRuns/{quote(dag_run_id, safe='')}/taskInstances"
        )

    def _paginate(self, path: str, key: str, limit: int = 100) -> List[Dict]:
        """Paginate through API results"""
        result: List[Dict] = []
        offset = 0
        total = limit

        while offset < total:
            query = {"limit": str(limit), "offset": str(offset)}
            response = self._invoke_rest_api(path, query=query)

            if not response:
                break

            page = response.get(key, [])
            if not page:
                break

            result.extend(page)
            total = response.get("total_entries", len(result))
            offset += limit

        return result

    def get_all_dags(self) -> List[Dict]:
        """Get all DAGs using pagination"""
        return self._paginate("/dags", key="dags")

    def build_dag_details(self, dag_data: Dict) -> AirflowApiDagDetails:
        """Build DAG details using existing model format"""
        dag_id = dag_data["dag_id"]

        # Parse tags
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

        # Parse schedule - MWAA typically uses schedule_interval format
        schedule = dag_data.get("schedule_interval")
        if isinstance(schedule, dict):
            schedule = schedule.get("value")

        # Get tasks for the DAG
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
        """Get DAG runs using existing model format"""
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
        """Get task instances using existing model format"""
        try:
            path = (
                f"/dags/{quote(dag_id, safe='')}"
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

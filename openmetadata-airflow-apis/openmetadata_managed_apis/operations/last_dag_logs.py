#  Copyright 2022 Collate
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
Module containing the logic to retrieve all logs from the tasks of a last DAG run
"""
from functools import partial
from io import StringIO
from typing import List, Optional

from airflow.models import DagModel, TaskInstance
from airflow.utils.log.log_reader import TaskLogReader
from flask import Response
from openmetadata_managed_apis.api.response import ApiResponse

LOG_METADATA = {
    "download_logs": False,
}
# Make chunks of 2M characters
CHUNK_SIZE = 2_000_000


def last_dag_logs(dag_id: str, task_id: str, after: Optional[int] = None) -> Response:
    """Validate that the DAG is registered by Airflow and have at least one Run.

    If exists, returns all logs for each task instance of the last DAG run.

    Args:
        dag_id (str): DAG to look for
        task_id (str): Task to fetch logs from
        after (int): log stream cursor

    Return:
        Response with log and pagination
    """

    dag_model = DagModel.get_dagmodel(dag_id=dag_id)

    if not dag_model:
        return ApiResponse.not_found(f"DAG {dag_id} not found.")

    last_dag_run = dag_model.get_last_dagrun(include_externally_triggered=True)

    if not last_dag_run:
        return ApiResponse.not_found(f"No DAG run found for {dag_id}.")

    task_instances: List[TaskInstance] = last_dag_run.get_task_instances()

    if not task_instances:
        return ApiResponse.not_found(
            f"Cannot find any task instance for the last DagRun of {dag_id}."
        )

    raw_logs_str = None

    for task_instance in task_instances:

        # Only fetch the required logs
        if task_instance.task_id == task_id:

            # Pick up the _try_number, otherwise they are adding 1
            try_number = task_instance._try_number  # pylint: disable=protected-access

            task_log_reader = TaskLogReader()
            if not task_log_reader.supports_read:
                return ApiResponse.server_error(
                    "Task Log Reader does not support read logs."
                )

            # Even when generating a ton of logs, we just get a single element.
            # Same happens when trying to call task_log_reader.read_log_chunks
            # We'll create our own chunk size and paginate based on that
            raw_logs_str = "".join(
                list(
                    task_log_reader.read_log_stream(
                        ti=task_instance,
                        try_number=try_number,
                        metadata=LOG_METADATA,
                    )
                )
            )

    if not raw_logs_str:
        return ApiResponse.bad_request(
            f"Can't fetch logs for DAG {dag_id} and Task {task_id}."
        )

    # Split the string in chunks of size without
    # having to know the full length beforehand
    log_chunks = [
        chunk for chunk in iter(partial(StringIO(raw_logs_str).read, CHUNK_SIZE), "")
    ]

    total = len(log_chunks)
    after_idx = int(after) if after is not None else 0

    if after_idx >= total:
        return ApiResponse.bad_request(
            f"After index {after} is out of bounds. Total pagination is {total} for DAG {dag_id} and Task {task_id}."
        )

    return ApiResponse.success(
        {
            task_id: log_chunks[after_idx],
            "total": len(log_chunks),
            # Only add the after if there are more pages
            **({"after": after_idx + 1} if after_idx < total - 1 else {}),
        }
    )

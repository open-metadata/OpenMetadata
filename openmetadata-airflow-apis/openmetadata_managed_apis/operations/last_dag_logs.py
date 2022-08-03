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
from typing import List

from airflow.models import DagModel, TaskInstance
from airflow.utils.log.log_reader import TaskLogReader
from flask import Response
from openmetadata_managed_apis.api.response import ApiResponse, ResponseFormat

LOG_METADATA = {
    "download_logs": True,
}


def last_dag_logs(dag_id: str) -> Response:
    """
    Validate that the DAG is registered by Airflow and have at least one Run.
    If exists, returns all logs for each task instance of the last DAG run.
    :param dag_id: DAG to find
    :return: API Response
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

    response = {}

    for task_instance in task_instances:

        # Pick up the _try_number, otherwise they are adding 1
        try_number = task_instance._try_number  # pylint: disable=protected-access

        task_log_reader = TaskLogReader()
        if not task_log_reader.supports_read:
            return ApiResponse.server_error(
                f"Task Log Reader does not support read logs."
            )

        logs = "\n".join(
            list(
                task_log_reader.read_log_stream(
                    ti=task_instance,
                    try_number=try_number,
                    metadata=LOG_METADATA,
                )
            )
        )

        response[task_instance.task_id] = ResponseFormat.b64_gzip_compression(logs)

    return ApiResponse.success(response)

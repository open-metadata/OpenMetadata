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
import base64
import glob
import gzip
import os
from pathlib import Path

from airflow.models import DagModel
from flask import Response
from openmetadata.api.response import ApiResponse


def last_dag_logs(dag_id: str, compress: bool = True) -> Response:
    """
    Validate that the DAG is registered by Airflow and have at least one Run.
    If exists, returns all logs for each task instance of the last DAG run.
    :param dag_id: DAG to find
    :param compress: to compress the results or not
    :return: API Response
    """

    dag_model = DagModel.get_dagmodel(dag_id=dag_id)

    if not dag_model:
        return ApiResponse.not_found(f"DAG '{dag_id}' not found.")

    last_dag_run = dag_model.get_last_dagrun(include_externally_triggered=True)

    if not last_dag_run:
        return ApiResponse.not_found(f"No DAG run found for '{dag_id}'.")

    task_instances = last_dag_run.get_task_instances()

    response = {}

    for task_instance in task_instances:
        if os.path.isfile(task_instance.log_filepath):
            response[task_instance.task_id] = Path(
                task_instance.log_filepath
            ).read_text()
        # logs could be kept in a directory with the same name than the log file path without extension per attempt
        elif os.path.isdir(os.path.splitext(task_instance.log_filepath)[0]):
            dir_path = os.path.splitext(task_instance.log_filepath)[0]
            sorted_logs = sorted(
                filter(os.path.isfile, glob.glob(f"{dir_path}/*.log")),
                key=os.path.getmtime,
            )

            log_res = f"\n*** Reading local file: {task_instance.log_filepath}\n".join(
                [Path(sorted_logs[-1]).read_text()]
            )

            # Return the base64 encoding of the response, removing the b'...' trailers
            response[task_instance.task_id] = (
                str(base64.b64encode(gzip.compress(bytes(log_res, "utf-8"))))[2:-1]
                if compress
                else log_res
            )

        else:
            return ApiResponse.not_found(
                f"Logs for task instance '{task_instance}' of DAG '{dag_id}' not found."
            )

    return ApiResponse.success(response)

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
Module containing the logic to delete a DAG
"""

import os
from pathlib import Path

from airflow import settings
from airflow.exceptions import AirflowException, DagNotFound
from airflow.models import TaskInstance
from airflow.utils.state import TaskInstanceState
from flask import Response

try:
    from airflow.api.common.delete_dag import delete_dag as airflow_delete_dag
except ImportError:
    from airflow.api.common.experimental.delete_dag import delete_dag as airflow_delete_dag

from openmetadata_managed_apis.api.config import (
    AIRFLOW_DAGS_FOLDER,
    DAG_GENERATED_CONFIGS,
)
from openmetadata_managed_apis.api.response import ApiResponse
from openmetadata_managed_apis.operations.kill_all import (
    fail_unfinished_runs,
    fail_unfinished_task_instances,
)
from openmetadata_managed_apis.utils.logger import operations_logger

logger = operations_logger()


def delete_dag_id(dag_id: str) -> Response:
    """
    Delete a DAG dag_id from the filesystem and airflow db.
    We clean:
    - py file in AIRFLOW_DAGS_FOLDER
    - config file in DAG_GENERATED_CONFIGS
    - DAG metadata, versions, runs and task history in airflow db

    Order matters: run Airflow's own delete FIRST so that its FK ordering
    (a task instance pins the DAG version it ran) is enforced BEFORE the
    files are removed. If that delete still fails, the files stay on disk
    and Airflow's next parse can restore the DAG rather than leaving an orphan.
    :param dag_id: DAG to delete
    :return: API Response
    """

    dag_py_file = Path(AIRFLOW_DAGS_FOLDER) / f"{dag_id}.py"
    config_file = Path(DAG_GENERATED_CONFIGS) / f"{dag_id}.json"

    with settings.Session() as session:
        deleted_dags = _delete_dag_records(dag_id, session)
        session.commit()

    deleted_file = False
    if dag_py_file.is_file():
        deleted_file = True
        os.remove(dag_py_file.absolute())  # noqa: PTH107

    deleted_config = False
    if config_file.is_file():
        deleted_config = True
        os.remove(config_file.absolute())  # noqa: PTH107

    if deleted_dags > 0 and deleted_file and deleted_config:
        return ApiResponse.success({"message": f"DAG [{dag_id}] has been deleted"})

    logger.error(
        "Could not fully delete DAG %s. Deleted database records: %s; DAG file: %s; config file: %s",
        dag_id,
        deleted_dags,
        deleted_file,
        deleted_config,
    )
    return ApiResponse.server_error()


def _delete_dag_records(dag_id: str, session) -> int:
    try:
        return airflow_delete_dag(dag_id, session=session)
    except DagNotFound:
        return 0
    except AirflowException:
        # Airflow refuses while a task is running (e.g. a scheduled run); the caller is deleting
        # the pipeline for good, so stop the run the same way kill does and delete again
        # (ADR:2026-10-29-deleting-a-pipeline-dag-stops-its-active-run)
        if not _has_running_task_instances(dag_id, session):
            raise
        logger.info("Stopping the active run of DAG %s before deleting it", dag_id)
        if not fail_unfinished_runs(dag_id, session):
            fail_unfinished_task_instances(dag_id, session)
        return airflow_delete_dag(dag_id, session=session)


def _has_running_task_instances(dag_id: str, session) -> bool:
    running = session.query(TaskInstance).filter(
        TaskInstance.dag_id == dag_id, TaskInstance.state == TaskInstanceState.RUNNING
    )
    return session.query(running.exists()).scalar()

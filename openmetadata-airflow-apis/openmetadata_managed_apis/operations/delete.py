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
Module containing the logic to delete a DAG
"""
import os
from pathlib import Path

from airflow import settings
from airflow.models import DagModel, DagRun
from flask import Response
from openmetadata_managed_apis.api.config import (
    AIRFLOW_DAGS_FOLDER,
    DAG_GENERATED_CONFIGS,
)
from openmetadata_managed_apis.api.response import ApiResponse


def delete_dag_id(dag_id: str) -> Response:
    """
    Delete a DAG dag_id from the filesystem and airflow db.
    We clean:
    - py file in AIRFLOW_DAGS_FOLDER
    - config file in DAG_GENERATED_CONFIGS
    - DagModel and DagRun entries in airflow db
    :param dag_id: DAG to delete
    :return: API Response
    """

    dag_py_file = Path(AIRFLOW_DAGS_FOLDER) / f"{dag_id}.py"
    config_file = Path(DAG_GENERATED_CONFIGS) / f"{dag_id}.json"

    deleted_file = False
    if dag_py_file.is_file():
        deleted_file = True
        os.remove(dag_py_file.absolute())

    deleted_config = False
    if config_file.is_file():
        deleted_config = True
        os.remove(config_file.absolute())

    with settings.Session() as session:

        deleted_dags = (
            session.query(DagModel).filter(DagModel.dag_id == dag_id).delete()
        )
        session.query(DagRun).filter(DagRun.dag_id == dag_id).delete()
        session.commit()

    if deleted_dags > 0 and deleted_file and deleted_config:
        return ApiResponse.success({"message": f"DAG [{dag_id}] has been deleted"})

    return ApiResponse.error(
        status=ApiResponse.STATUS_SERVER_ERROR,
        error=f"Could not find and delete {dag_id}. Deleted dags: {deleted_dags}; "
        + f"deleted {dag_py_file}: {deleted_file}",
    )

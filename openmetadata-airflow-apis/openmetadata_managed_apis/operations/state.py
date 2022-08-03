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
Module containing the logic to toggle DAG state between enabled/disabled
"""
from airflow import settings
from airflow.models import DagModel
from flask import Response
from openmetadata_managed_apis.api.response import ApiResponse


def _update_dag_state(dag_id: str, paused: bool, message: str) -> Response:
    """
    Given a DAG id, a boolean and a message, update
    the DAG state between paused or unpaused.
    :param dag_id: DAG to update
    :param paused: state to set
    :param message: message to return
    :return: API Response
    """

    with settings.Session() as session:

        dag_model: DagModel = (
            session.query(DagModel).filter(DagModel.dag_id == dag_id).first()
        )

        if not dag_model:
            return ApiResponse.not_found(f"DAG {dag_id} not found.")

        dag_model.is_paused = paused
        session.commit()

        return ApiResponse.success({"message": message})


def enable_dag(dag_id: str) -> Response:
    """
    Unpause the DAG
    :param dag_id: DAG to find
    :return: API Response
    """

    return _update_dag_state(
        dag_id=dag_id, paused=False, message=f"DAG {dag_id} has been enabled"
    )


def disable_dag(dag_id: str) -> Response:
    """
    Pause the DAG
    :param dag_id: DAG to find
    :return: API Response
    """

    return _update_dag_state(
        dag_id=dag_id, paused=True, message=f"DAG {dag_id} has been disabled"
    )

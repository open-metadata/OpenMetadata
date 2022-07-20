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
Module containing the logic to kill all DAG not finished executions
"""

from airflow import settings
from airflow.models import DagModel, DagRun
from flask import Response
from openmetadata.api.response import ApiResponse, ResponseFormat


def kill_all(dag_id: str) -> Response:
    """
    Validate that the DAG is registered by Airflow.
    If exists, check the DagRun
    :param dag_id: DAG to find
    :return: API Response
    """

    pass

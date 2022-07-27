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
Return the last DagRun logs for each task
"""
import logging
import traceback

from airflow.api_connexion import security
from airflow.security import permissions
from airflow.www.app import csrf
from flask import Response
from openmetadata_managed_apis.api.app import blueprint
from openmetadata_managed_apis.api.response import ApiResponse
from openmetadata_managed_apis.api.utils import get_arg_dag_id
from openmetadata_managed_apis.operations.last_dag_logs import last_dag_logs


@blueprint.route("/last_dag_logs", methods=["GET"])
@csrf.exempt
@security.requires_access([(permissions.ACTION_CAN_READ, permissions.RESOURCE_DAG)])
def last_logs() -> Response:
    """
    Retrieve all logs from the task instances of a last DAG run
    """

    dag_id = get_arg_dag_id()

    try:
        return last_dag_logs(dag_id)

    except Exception as exc:
        logging.info(f"Failed to get last run logs for '{dag_id}'")
        return ApiResponse.error(
            status=ApiResponse.STATUS_SERVER_ERROR,
            error=f"Failed to get last run logs for '{dag_id}' due to {exc} - {traceback.format_exc()}",
        )

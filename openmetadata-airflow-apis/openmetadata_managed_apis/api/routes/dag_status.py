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
Health endpoint. Globally accessible
"""
import logging
import traceback

from airflow.api_connexion import security
from airflow.security import permissions
from airflow.www.app import csrf
from flask import Response
from openmetadata_managed_apis.api.app import blueprint
from openmetadata_managed_apis.api.config import MISSING_DAG_ID_EXCEPTION_MSG
from openmetadata_managed_apis.api.response import ApiResponse
from openmetadata_managed_apis.api.utils import get_arg_dag_id
from openmetadata_managed_apis.operations.status import status


@blueprint.route("/status", methods=["GET"])
@csrf.exempt
@security.requires_access([(permissions.ACTION_CAN_READ, permissions.RESOURCE_DAG)])
def dag_status() -> Response:
    """
    Check the status of a DAG runs
    """
    dag_id = get_arg_dag_id()

    if not dag_id:
        return ApiResponse.bad_request(MISSING_DAG_ID_EXCEPTION_MSG)

    try:
        return status(dag_id)

    except Exception as exc:
        logging.info(f"Failed to get dag {dag_id} status")
        return ApiResponse.error(
            status=ApiResponse.STATUS_SERVER_ERROR,
            error=f"Failed to get status for {dag_id} due to {exc} - {traceback.format_exc()}",
        )

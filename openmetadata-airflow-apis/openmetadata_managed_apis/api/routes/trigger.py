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
Trigger endpoint
"""
import traceback
import logging
from airflow.www.app import csrf
from flask import Response, request
from openmetadata_managed_apis.api.app import blueprint
from openmetadata_managed_apis.api.response import ApiResponse
from openmetadata_managed_apis.api.rest_api import MISSING_DAG_ID_EXCEPTION_MSG
from openmetadata_managed_apis.operations.trigger import trigger
from openmetadata_managed_apis.api.utils import get_request_dag_id, get_request_arg

from airflow.api_connexion import security
from airflow.security import permissions


@blueprint.route("/trigger_dag", methods=["POST"])
@csrf.exempt
@security.requires_access([(permissions.RESOURCE_TRIGGER, permissions.RESOURCE_DAG)])
def trigger_dag() -> Response:
    """
    Trigger a dag run
    """
    dag_id = get_request_dag_id()

    if not dag_id:
        return ApiResponse.bad_request(MISSING_DAG_ID_EXCEPTION_MSG)

    try:
        run_id = get_request_arg(request, "run_id")
        response = trigger(dag_id, run_id)

        return response

    except Exception as exc:
        logging.info(f"Failed to trigger dag {dag_id}")
        return ApiResponse.error(
            status=ApiResponse.STATUS_SERVER_ERROR,
            error=f"Workflow {dag_id} has filed to trigger due to {exc} - {traceback.format_exc()}",
        )

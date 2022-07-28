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
Test the connection against a source system
"""
import traceback

from airflow.api_connexion import security
from airflow.security import permissions
from airflow.www.app import csrf
from flask import Response, request
from openmetadata_managed_apis.api.app import blueprint
from openmetadata_managed_apis.api.response import ApiResponse
from openmetadata_managed_apis.operations.test_connection import test_source_connection
from pydantic import ValidationError

from metadata.ingestion.api.parser import parse_test_connection_request_gracefully


@blueprint.route("/test_connection", methods=["POST"])
@csrf.exempt
@security.requires_access([(permissions.ACTION_CAN_READ, permissions.RESOURCE_DAG)])
def test_connection() -> Response:
    """
    Given a WorkflowSource Schema, create the engine
    and test the connection
    """
    json_request = request.get_json()

    try:
        test_service_connection = parse_test_connection_request_gracefully(
            config_dict=json_request
        )
        response = test_source_connection(test_service_connection)

        return response

    except ValidationError as err:
        return ApiResponse.error(
            status=ApiResponse.STATUS_BAD_REQUEST,
            error=f"Request Validation Error parsing payload. (Workflow)Source expected - {err}",
        )

    except Exception as err:
        return ApiResponse.error(
            status=ApiResponse.STATUS_SERVER_ERROR,
            error=f"Internal error testing connection {err} - {traceback.format_exc()}",
        )

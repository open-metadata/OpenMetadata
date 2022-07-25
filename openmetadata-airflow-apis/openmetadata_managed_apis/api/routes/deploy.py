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
import traceback

from airflow.api_connexion import security
from airflow.security import permissions
from airflow.www.app import csrf
from flask import Response, request
from openmetadata_managed_apis.api.app import blueprint
from openmetadata_managed_apis.api.response import ApiResponse
from openmetadata_managed_apis.api.utils import get_dagbag
from openmetadata_managed_apis.operations.deploy import DagDeployer
from pydantic import ValidationError

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)


@blueprint.route("/deploy", methods=["POST"])
@csrf.exempt
@security.requires_access([(permissions.ACTION_CAN_CREATE, permissions.RESOURCE_DAG)])
def deploy_dag() -> Response:
    """
    Custom Function for the deploy_dag API
    Creates workflow dag based on workflow dag file and refreshes
    the session
    """

    json_request = request.get_json()

    try:
        ingestion_pipeline = IngestionPipeline(**json_request)

        deployer = DagDeployer(ingestion_pipeline, get_dagbag())
        response = deployer.deploy()

        return response

    except ValidationError as err:
        return ApiResponse.error(
            status=ApiResponse.STATUS_BAD_REQUEST,
            error=f"Request Validation Error parsing payload {json_request}. IngestionPipeline expected - {err}",
        )

    except Exception as err:
        return ApiResponse.error(
            status=ApiResponse.STATUS_SERVER_ERROR,
            error=f"Internal error deploying {json_request} - {err} - {traceback.format_exc()}",
        )

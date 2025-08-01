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
Deploy the DAG and scan it with the scheduler
"""
import traceback
from typing import Callable

from flask import Blueprint, Response, request
from openmetadata_managed_apis.api.response import ApiResponse
from openmetadata_managed_apis.operations.deploy import DagDeployer
from openmetadata_managed_apis.utils.logger import routes_logger
from pydantic import ValidationError

from metadata.ingestion.api.parser import parse_ingestion_pipeline_config_gracefully

logger = routes_logger()


def get_fn(blueprint: Blueprint) -> Callable:
    """
    Return the function loaded to a route
    :param blueprint: Flask Blueprint to assign route to
    :return: routed function
    """

    # Lazy import the requirements
    # pylint: disable=import-outside-toplevel
    from airflow.api_connexion import security
    from airflow.security import permissions
    from airflow.www.app import csrf

    @blueprint.route("/deploy", methods=["POST"])
    @csrf.exempt
    @security.requires_access(
        [(permissions.ACTION_CAN_CREATE, permissions.RESOURCE_DAG)]
    )
    def deploy_dag() -> Response:
        """
        Custom Function for the deploy_dag API
        Creates workflow dag based on workflow dag file and refreshes
        the session
        """

        json_request = request.get_json(cache=False)

        try:
            if json_request is None:
                return ApiResponse.error(
                    status=ApiResponse.STATUS_BAD_REQUEST,
                    error="Did not receive any JSON request to deploy",
                )

            ingestion_pipeline = parse_ingestion_pipeline_config_gracefully(
                json_request
            )

            deployer = DagDeployer(ingestion_pipeline)
            response = deployer.deploy()

            return response

        except ValidationError as err:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Request Validation Error parsing payload [{json_request}]. IngestionPipeline expected: {err}"
            )
            return ApiResponse.error(
                status=ApiResponse.STATUS_BAD_REQUEST,
                error=f"Request Validation Error parsing payload. IngestionPipeline expected: {err}",
            )

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Internal error deploying [{json_request}] due to [{exc}] ")
            return ApiResponse.error(
                status=ApiResponse.STATUS_SERVER_ERROR,
                error=f"Internal error while deploying due to [{exc}] ",
            )

    return deploy_dag

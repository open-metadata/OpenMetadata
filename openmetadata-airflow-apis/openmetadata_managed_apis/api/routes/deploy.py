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
from typing import Callable  # noqa: UP035

from flask import Blueprint, Response, request
from pydantic import ValidationError

from metadata.ingestion.api.parser import parse_ingestion_pipeline_config_gracefully
from openmetadata_managed_apis.api.response import ApiResponse
from openmetadata_managed_apis.operations.deploy import DagDeployer
from openmetadata_managed_apis.utils.logger import routes_logger

logger = routes_logger()


def get_fn(blueprint: Blueprint) -> Callable:
    """
    Return the function loaded to a route
    :param blueprint: Flask Blueprint to assign route to
    :return: routed function
    """

    # Lazy import the requirements
    # pylint: disable=import-outside-toplevel
    from airflow.security import permissions  # noqa: PLC0415

    from openmetadata_managed_apis.utils.airflow_version import is_airflow_3_or_higher  # noqa: PLC0415
    from openmetadata_managed_apis.utils.security_compat import (  # noqa: PLC0415
        requires_access_decorator,
    )

    # CSRF protection import - different between Airflow 2.x and 3.x
    if not is_airflow_3_or_higher():
        from airflow.www.app import csrf  # noqa: PLC0415
    else:
        from airflow.providers.fab.www.app import csrf  # noqa: PLC0415

    @blueprint.route("/deploy", methods=["POST"])
    @csrf.exempt
    @requires_access_decorator([(permissions.ACTION_CAN_CREATE, permissions.RESOURCE_DAG)])
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

            ingestion_pipeline = parse_ingestion_pipeline_config_gracefully(json_request)

            deployer = DagDeployer(ingestion_pipeline)
            response = deployer.deploy()

            return response  # noqa: RET504, TRY300

        except ValidationError as err:
            logger.debug(traceback.format_exc())
            logger.error(  # noqa: TRY400
                f"Request Validation Error parsing payload [{json_request}]. IngestionPipeline expected: {err}"
            )
            return ApiResponse.error(
                status=ApiResponse.STATUS_BAD_REQUEST,
                error=f"Request Validation Error parsing payload. IngestionPipeline expected: {err}",
            )

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Internal error deploying [{json_request}] due to [{exc}] ")  # noqa: TRY400
            return ApiResponse.error(
                status=ApiResponse.STATUS_SERVER_ERROR,
                error=f"Internal error while deploying due to [{exc}] ",
            )

    return deploy_dag

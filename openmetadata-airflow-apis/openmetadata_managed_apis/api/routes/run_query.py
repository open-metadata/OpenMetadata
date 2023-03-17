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
Run SQL query against a source system
"""
import traceback
from typing import Callable

from flask import Blueprint, Response, request
from marshmallow import ValidationError
from openmetadata_managed_apis.api.response import ApiResponse
from openmetadata_managed_apis.operations.run_sql_query import run_sql_query
from openmetadata_managed_apis.utils.logger import routes_logger

from metadata.generated.schema.entity.automations.runQueryRequest import QueryTypes
from metadata.ingestion.api.parser import parse_run_query_request_gracefully

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

    @blueprint.route("/run_query", methods=["POST"])
    @csrf.exempt
    @security.requires_access([(permissions.ACTION_CAN_READ, permissions.RESOURCE_DAG)])
    def run_query() -> Response:
        """
        Given a runQueryRequest config create an engine
        and execute the query
        """

        json_request = request.get_json(cache=False)

        # validate that RUN type has offset and limit

        try:
            run_query_config = parse_run_query_request_gracefully(
                config_dict=json_request
            )
            if (
                run_query_config.queryType == QueryTypes.RUN
                and run_query_config.limit is None
                and run_query_config.offset is None
            ):
                return ApiResponse.error(
                    status=ApiResponse.STATUS_BAD_REQUEST,
                    error="[limit] and [offset] must be specified for a [RUN] query request",
                )

            if (
                run_query_config.queryType == QueryTypes.RUN
                and run_query_config.limit > 100
            ):
                return ApiResponse.error(
                    status=ApiResponse.STATUS_BAD_REQUEST,
                    error="[limit] must be less than 100",
                )

            return run_sql_query(run_query_config)
        except ValidationError as err:
            msg = f"Request Validation Error parsing payload: {err}"
            logger.debug(traceback.format_exc())
            logger.error(msg)
            return ApiResponse.error(
                status=ApiResponse.STATUS_BAD_REQUEST,
                error=msg,
            )
        except Exception as err:
            msg = f"Uncaught error: {err}"
            logger.debug(traceback.format_exc())
            logger.error(msg)
            return ApiResponse.error(
                status=ApiResponse.STATUS_SERVER_ERROR,
                error=msg,
            )

    return run_query

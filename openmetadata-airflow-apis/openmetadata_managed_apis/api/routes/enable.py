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
Enable/unpause a DAG
"""
import traceback
from typing import Callable

from flask import Blueprint, Response
from openmetadata_managed_apis.api.response import ApiResponse
from openmetadata_managed_apis.api.utils import get_request_dag_id
from openmetadata_managed_apis.operations.state import enable_dag
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
    from airflow.security import permissions
    from openmetadata_managed_apis.utils.airflow_version import is_airflow_3_or_higher
    from openmetadata_managed_apis.utils.security_compat import (
        requires_access_decorator,
    )

    # CSRF protection import - different between Airflow 2.x and 3.x
    if not is_airflow_3_or_higher():
        from airflow.www.app import csrf
    else:
        # Airflow 3.x doesn't have csrf in the same location, use a no-op
        class csrf:
            @staticmethod
            def exempt(f):
                return f

    @blueprint.route("/enable", methods=["POST"])
    @csrf.exempt
    @requires_access_decorator(
        [(permissions.ACTION_CAN_EDIT, permissions.RESOURCE_DAG)]
    )
    def enable() -> Response:
        """
        Given a DAG ID, mark the dag as enabled
        """
        dag_id = get_request_dag_id()

        try:
            return enable_dag(dag_id)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get last run logs for [{dag_id}]: {exc}")
            return ApiResponse.error(
                status=ApiResponse.STATUS_SERVER_ERROR,
                error=f"Failed to get last run logs for [{dag_id}] due to {exc} ",
            )

    return enable

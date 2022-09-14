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
from typing import Callable

from flask import Blueprint
from openmetadata_managed_apis.utils.logger import routes_logger

try:
    from importlib.metadata import version
except ImportError:
    from importlib_metadata import version

from openmetadata_managed_apis.api.response import ApiResponse

logger = routes_logger()


def get_fn(blueprint: Blueprint) -> Callable:
    """
    Return the function loaded to a route
    :param blueprint: Flask Blueprint to assign route to
    :return: routed function
    """

    # Lazy import the requirements
    # pylint: disable=import-outside-toplevel
    from airflow.www.app import csrf

    @blueprint.route("/health", methods=["GET"])
    @csrf.exempt
    def health():
        """
        /health endpoint to check Airflow REST status without auth
        """

        try:
            return ApiResponse.success(
                {"status": "healthy", "version": version("openmetadata-ingestion")}
            )
        except Exception as exc:
            msg = f"Internal error obtaining REST status due to [{exc}] "
            logger.debug(traceback.format_exc())
            logger.error(msg)
            return ApiResponse.error(
                status=ApiResponse.STATUS_SERVER_ERROR,
                error=msg,
            )

    return health

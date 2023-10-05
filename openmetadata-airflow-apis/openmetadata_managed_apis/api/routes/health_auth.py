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
from typing import Callable

from flask import Blueprint
from openmetadata_managed_apis.operations.health import health_response
from openmetadata_managed_apis.utils.logger import routes_logger

try:
    pass
except ImportError:
    pass

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

    @blueprint.route("/health-auth", methods=["GET"])
    @csrf.exempt
    @security.requires_access(
        [(permissions.ACTION_CAN_CREATE, permissions.RESOURCE_DAG)]
    )
    def health_auth():
        """
        /auth-health endpoint to check Airflow REST status without auth
        """

        return health_response()

    return health_auth

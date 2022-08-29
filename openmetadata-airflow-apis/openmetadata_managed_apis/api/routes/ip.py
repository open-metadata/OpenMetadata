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
IP endpoint
"""
import traceback

import requests
from openmetadata_managed_apis.utils.logger import routes_logger

try:
    from importlib.metadata import version
except ImportError:
    from importlib_metadata import version

from airflow.api_connexion import security
from airflow.security import permissions
from airflow.www.app import csrf
from openmetadata_managed_apis.api.app import blueprint
from openmetadata_managed_apis.api.response import ApiResponse

logger = routes_logger()


@blueprint.route("/ip", methods=["GET"])
@csrf.exempt
@security.requires_access([(permissions.ACTION_CAN_EDIT, permissions.RESOURCE_DAG)])
def get_host_ip():
    """
    /ip endpoint to check Airflow host IP. Users will need to whitelist
    this IP to access their source systems.
    """

    try:
        return ApiResponse.success({"ip": requests.get("https://api.ipify.org").text})
    except Exception as exc:
        msg = f"Internal error obtaining host IP due to [{exc}] "
        logger.debug(traceback.format_exc())
        logger.error(msg)
        return ApiResponse.error(
            status=ApiResponse.STATUS_SERVER_ERROR,
            error=msg,
        )

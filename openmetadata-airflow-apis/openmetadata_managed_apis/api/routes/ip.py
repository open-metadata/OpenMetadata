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
from typing import Callable, Optional

import requests
from flask import Blueprint
from openmetadata_managed_apis.api.response import ApiResponse
from openmetadata_managed_apis.utils.logger import routes_logger
from requests.exceptions import ConnectionError
from urllib3.exceptions import NewConnectionError

logger = routes_logger()

IP_SERVICES = ["https://api.ipify.org", "https://api.my-ip.io/ip"]


def _get_ip_safely(url: str) -> Optional[str]:
    """
    Safely retrieve the public IP
    :param url: Service giving us the IP
    :return: Host IP
    """

    try:
        host_ip = requests.get(url)
        return host_ip.text
    except (NewConnectionError, ConnectionError, ValueError) as err:
        logger.debug(traceback.format_exc())
        logger.warning(
            f"Could not extract IP info from {url} due to {err}. Retrying..."
        )
        return None


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

    @blueprint.route("/ip", methods=["GET"])
    @csrf.exempt
    @security.requires_access([(permissions.ACTION_CAN_EDIT, permissions.RESOURCE_DAG)])
    def get_host_ip():
        """
        /ip endpoint to check Airflow host IP. Users will need to whitelist
        this IP to access their source systems.
        """

        try:

            for ip_service in IP_SERVICES:
                host_ip = _get_ip_safely(ip_service)
                if host_ip:
                    return ApiResponse.success({"ip": host_ip})

            # If we cannot fetch the IP, still return a 200 but without informing the IP.
            return ApiResponse.success({"ip": "unknown"})

        except Exception as exc:
            msg = f"Internal error obtaining host IP due to [{exc}] "
            logger.debug(traceback.format_exc())
            logger.error(msg)
            return ApiResponse.error(
                status=ApiResponse.STATUS_SERVER_ERROR,
                error=msg,
            )

    return get_host_ip

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
CSRF Token endpoint to provide token for POST/PUT/DELETE requests
"""
from typing import Callable

from flask import Blueprint, session
from openmetadata_managed_apis.api.response import ApiResponse
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
    from openmetadata_managed_apis.utils.security_compat import (
        requires_access_decorator,
    )

    @blueprint.route("/csrf-token", methods=["GET"])
    @requires_access_decorator(
        [(permissions.ACTION_CAN_READ, permissions.RESOURCE_DAG)]
    )
    def get_csrf_token():
        """
        Get CSRF token for subsequent POST/PUT/DELETE requests.
        This endpoint establishes a session and returns the CSRF token.

        The client should:
        1. Call this endpoint to get the token
        2. Store the session cookies
        3. Include X-CSRFToken header in subsequent requests
        4. Include the session cookies
        """
        try:
            # Try to get CSRF token from Flask session
            csrf_token = None

            # Check different possible locations for CSRF token
            if "csrf_token" in session:
                csrf_token = session["csrf_token"]
            elif "_csrf_token" in session:
                csrf_token = session["_csrf_token"]

            # If no token in session, try to generate one
            if not csrf_token:
                try:
                    # Try Flask-WTF's generate_csrf
                    from flask_wtf.csrf import generate_csrf

                    csrf_token = generate_csrf()
                except ImportError:
                    logger.debug("Flask-WTF not available")

            # If still no token, create a session ID as fallback
            if not csrf_token and hasattr(session, "sid"):
                csrf_token = session.sid

            if csrf_token:
                return ApiResponse.success(
                    {
                        "csrf_token": csrf_token,
                        "message": "Include this token in X-CSRFToken header for POST/PUT/DELETE requests",
                    }
                )
            else:
                # CSRF might be disabled - return success with info
                return ApiResponse.success(
                    {
                        "csrf_token": None,
                        "message": "CSRF protection appears to be disabled",
                    }
                )

        except Exception as exc:
            logger.error(f"Failed to get CSRF token: {exc}")
            return ApiResponse.error(
                status=ApiResponse.STATUS_SERVER_ERROR,
                error=f"Failed to retrieve CSRF token: {exc}",
            )

    return get_csrf_token
